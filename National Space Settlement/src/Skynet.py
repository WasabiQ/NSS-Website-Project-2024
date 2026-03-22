import sys
import torch
import torch.nn as nn
import torch.nn.functional as F
import pandas as pd

from datetime import datetime
from collections import defaultdict

from torch.optim.lr_scheduler import OneCycleLR
from torch.cuda.amp import autocast, GradScaler

from torch_geometric.nn import TransformerConv, global_mean_pool
from torch_geometric.loader import DataLoader
from torch_geometric.data import Data

from rdkit import Chem
from rdkit.Chem import AllChem
from rdkit.Chem.Scaffolds import MurckoScaffold

import chemical_vault_pb2


# ============================================================
# LOGGING
# ============================================================

def log(tag, msg):
    t = datetime.now().strftime("%H:%M:%S")
    print(f"[{t}] [{tag}] {msg}", file=sys.stderr)


# ============================================================
# TOX21 RECEPTORS
# ============================================================

RECEPTORS = [
    "NR-AR","NR-AR-LBD","NR-AhR","NR-Aromatase",
    "NR-ER","NR-ER-LBD","NR-PPAR-gamma",
    "SR-ARE","SR-ATAD5","SR-HSE","SR-MMP","SR-p53"
]


# ============================================================
# GRADIENT CENTRALIZATION
# ============================================================

def centralize_gradients(model):
    for p in model.parameters():
        if p.grad is not None and p.ndim > 1:
            p.grad -= p.grad.mean(dim=tuple(range(1, p.ndim)), keepdim=True)


# ============================================================
# SCAFFOLD SPLIT
# ============================================================

def get_scaffold(smiles):

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None

    return MurckoScaffold.MurckoScaffoldSmiles(mol=mol)


def scaffold_split(df, test_ratio=0.2):

    scaffolds = defaultdict(list)

    for idx, row in df.iterrows():
        scaf = get_scaffold(row["smiles"])
        scaffolds[scaf].append(idx)

    train_idx = []
    test_idx = []

    for group in scaffolds.values():

        if len(test_idx) / len(df) < test_ratio:
            test_idx += group
        else:
            train_idx += group

    return df.loc[train_idx], df.loc[test_idx]


# ============================================================
# SMILES → GRAPH
# ============================================================

def smiles_to_graph(smiles, targets=None):

    mol = Chem.MolFromSmiles(smiles)

    if mol is None:
        return None

    mol = Chem.AddHs(mol)

    try:
        AllChem.EmbedMolecule(mol, AllChem.ETKDG())
        AllChem.UFFOptimizeMolecule(mol)
    except:
        return None

    node_features = []

    for atom in mol.GetAtoms():

        node_features.append([
            atom.GetAtomicNumber(),
            atom.GetDegree(),
            atom.GetFormalCharge(),
            int(atom.GetHybridization()),
            float(atom.GetIsAromatic())
        ])

    x = torch.tensor(node_features, dtype=torch.float)

    edges = []

    for bond in mol.GetBonds():

        i = bond.GetBeginAtomIdx()
        j = bond.GetEndAtomIdx()

        edges.append([i, j])
        edges.append([j, i])

    edge_index = torch.tensor(edges, dtype=torch.long).t().contiguous()

    pos = torch.tensor(
        mol.GetConformer().GetPositions(),
        dtype=torch.float
    )

    data = Data(x=x, edge_index=edge_index, pos=pos)

    if targets is not None:
        data.y = torch.tensor(targets, dtype=torch.float)

    return data


# ============================================================
# MODEL BLOCK
# ============================================================

class HybridBlock(nn.Module):

    def __init__(self, hidden):

        super().__init__()

        self.norm1 = nn.LayerNorm(hidden)

        self.conv = TransformerConv(
            hidden,
            hidden // 4,
            heads=4
        )

        self.norm2 = nn.LayerNorm(hidden)

        self.ff = nn.Sequential(
            nn.Linear(hidden, hidden * 2),
            nn.GELU(),
            nn.Linear(hidden * 2, hidden)
        )

        self.dropout = nn.Dropout(0.1)

    def forward(self, x, edge_index):

        identity = x

        x = self.norm1(x)
        x = self.conv(x, edge_index)
        x = self.dropout(x)

        x = x + identity

        x = x + self.ff(self.norm2(x))

        return x


# ============================================================
# MODEL
# ============================================================

class SkynetArchitecture(nn.Module):

    def __init__(self, input_dim=5, hidden=192):

        super().__init__()

        self.proj = nn.Linear(input_dim, hidden)

        self.layers = nn.ModuleList(
            [HybridBlock(hidden) for _ in range(6)]
        )

        self.head = nn.Sequential(
            nn.Linear(hidden, 128),
            nn.GELU(),
            nn.Linear(128, 12)
        )

    def forward(self, data):

        x = data.x
        edge_index = data.edge_index
        batch = data.batch

        x = F.gelu(self.proj(x))

        for layer in self.layers:
            x = layer(x, edge_index)

        x = global_mean_pool(x, batch)

        embedding = x

        logits = self.head(x)

        return logits, embedding


# ============================================================
# LOAD VAULT
# ============================================================

def load_vault(path="chemical_vault.bin"):

    vault = chemical_vault_pb2.ChemicalVault()

    with open(path, "rb") as f:
        vault.ParseFromString(f.read())

    return [m.smiles for m in vault.molecules]


# ============================================================
# BUILD EMBEDDING DATABASE
# ============================================================

def build_embedding_database(model, device):

    smiles_list = load_vault()

    graphs = []

    for s in smiles_list:

        g = smiles_to_graph(s)

        if g:
            graphs.append(g)

    loader = DataLoader(graphs, batch_size=32)

    embeddings = []
    model.eval()

    with torch.no_grad():

        for batch in loader:

            batch = batch.to(device)

            _, emb = model(batch)

            embeddings.append(emb.cpu())

    embeddings = torch.cat(embeddings)

    return embeddings


# ============================================================
# TRAINING
# ============================================================

def run_training(epochs=50, batch_size=32):

    log("SYSTEM", "Loading dataset")

    df = pd.read_csv("Tox21.csv")

    train_df, test_df = scaffold_split(df)

    train_graphs = []

    for _, row in train_df.iterrows():

        g = smiles_to_graph(
            row["smiles"],
            row[RECEPTORS].values
        )

        if g:
            train_graphs.append(g)

    loader = DataLoader(
        train_graphs,
        batch_size=batch_size,
        shuffle=True
    )

    device = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )

    model = SkynetArchitecture().to(device)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=1e-3,
        weight_decay=1e-2
    )

    scheduler = OneCycleLR(
        optimizer,
        max_lr=1e-3,
        epochs=epochs,
        steps_per_epoch=len(loader)
    )

    criterion = nn.BCEWithLogitsLoss()

    scaler = GradScaler(enabled=(device.type == "cuda"))

    log("SYSTEM", "Training start")

    model.train()

    for epoch in range(epochs):

        total_loss = 0

        for batch in loader:

            batch = batch.to(device)

            optimizer.zero_grad()

            with autocast(enabled=(device.type == "cuda")):

                logits, _ = model(batch)

                loss = criterion(
                    logits,
                    batch.y
                )

            scaler.scale(loss).backward()

            centralize_gradients(model)

            scaler.step(optimizer)
            scaler.update()

            scheduler.step()

            total_loss += loss.item()

        log(
            "EPOCH",
            f"{epoch+1}/{epochs} | loss={total_loss/len(loader):.5f}"
        )

    log("SYSTEM", "Training complete")

    return model