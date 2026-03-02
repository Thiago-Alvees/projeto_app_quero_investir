import type { FiiType } from "../../domain/models/fiiType";
import { FII_TYPES } from "../../domain/models/fiiType";

export const FII_GROUPS: Record<FiiType, string[]> = {
  Logistica: [
    "HGLG11",
    "XPLG11",
    "VILG11",
    "BTLG11",
    "GGRC11",
    "GARE11",
    "LVBI11",
    "HSLG11",
    "SARE11",
    "BRCO11",
    "GLOG11",
    "RBRL11",
  ],
  Shoppings: [
    "VISC11",
    "XPML11",
    "HSML11",
    "PMLL11",
    "FLRP11",
    "HGBS11",
    "TORD11",
    "ABCP11",
  ],
  Lajes: [
    "KNRI11",
    "HGRE11",
    "RCRB11",
    "VINO11",
    "BRCR11",
    "PVBI11",
    "JSRE11",
    "AIEC11",
  ],
  "Papel/CRI": [
    "MXRF11",
    "CPTS11",
    "KNCR11",
    "KNSC11",
    "RECR11",
    "VGIR11",
    "RBRR11",
    "IRDM11",
    "HCTR11",
    "DEVA11",
    "URPR11",
    "VGHF11",
  ],
  "Hibridos/Outros": [
    "BTHF11",
    "RBRF11",
    "HGRU11",
    "RBVA11",
    "RECT11",
    "ALZR11",
    "RBED11",
    "FIIB11",
    "RZTR11",
    "MORE11",
  ],
};

export const FII_UNIVERSE = Object.values(FII_GROUPS).reduce<string[]>(
  (acc, group) => acc.concat(group),
  []
);

const typeByTicker: Record<string, FiiType> = {};

for (const type of FII_TYPES) {
  for (const ticker of FII_GROUPS[type]) {
    typeByTicker[ticker] = type;
  }
}

export const FII_TYPE_BY_TICKER = typeByTicker;
