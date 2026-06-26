import { useEffect, useState } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte } from "@/composants/ui.jsx";
import { majEcole, majConfigMatricule } from "@/lib/academique.js";
import { MODULES, tousLesModules } from "@/lib/modules.js";

const DEVISES = ["XOF", "XAF", "EUR", "USD", "GNF", "MAD"];

export default function Parametres() {
  const { ecoleId, ecole, rafraichirProfil } = useAuth();
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");

  const action = async (fn) => {
    setErreur(""); setInfo("");
    try { await fn(); await rafraichirProfil(); setInfo("Enregistré ✓"); }
    catch (e) { setErreur(e.message); }
  };

  return (
    <>
      <EnTete titre="Paramètres" sousTitre="Configuration de l'établissement" />
      <div className="max-w-2xl space-y-6 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>
        {info && <Alerte ton="succes">{info}</Alerte>}

        <ProfilEcole ecole={ecole} onSave={(v) => action(() => majEcole(ecoleId, v))} />
        <Matricule ecole={ecole} onSave={(v) => action(() => majConfigMatricule(ecoleId, v))} />
        <ModulesActifs ecole={ecole} onSave={(mods) => action(() => majEcole(ecoleId, { modules_actifs: mods }))} />
      </div>
    </>
  );
}

function ProfilEcole({ ecole, onSave }) {
  const [f, setF] = useState({ nom: "", sigle: "", devise: "XOF", couleur_primaire: "#0B1F3A", couleur_secondaire: "#C9A227" });
  useEffect(() => {
    if (!ecole) return;
    setF({
      nom: ecole.nom || "", sigle: ecole.sigle || "", devise: ecole.devise || "XOF",
      couleur_primaire: ecole.couleur_primaire || "#0B1F3A",
      couleur_secondaire: ecole.couleur_secondaire || "#C9A227",
    });
  }, [ecole]);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Carte className="p-6">
      <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Établissement</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ label="Nom" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
        <Champ label="Sigle" value={f.sigle} onChange={(e) => maj("sigle", e.target.value.toUpperCase())} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Devise</span>
          <select value={f.devise} onChange={(e) => maj("devise", e.target.value)}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            {DEVISES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Couleur 1</span>
            <input type="color" value={f.couleur_primaire} onChange={(e) => maj("couleur_primaire", e.target.value)}
              className="h-10 w-16 rounded-lg border border-navy-900/15" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Couleur 2</span>
            <input type="color" value={f.couleur_secondaire} onChange={(e) => maj("couleur_secondaire", e.target.value)}
              className="h-10 w-16 rounded-lg border border-navy-900/15" />
          </label>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Bouton onClick={() => onSave(f)}>Enregistrer</Bouton>
      </div>
    </Carte>
  );
}

function ModulesActifs({ ecole, onSave }) {
  // null = tous actifs
  const [actifs, setActifs] = useState(() => new Set(tousLesModules()));
  useEffect(() => {
    if (!ecole) return;
    setActifs(new Set(ecole.modules_actifs ?? tousLesModules()));
  }, [ecole]);

  const toggle = (id) => setActifs((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <Carte className="p-6">
      <h3 className="mb-1 font-display text-lg font-semibold text-navy-900">Modules actifs</h3>
      <p className="mb-4 text-xs text-navy-900/40">
        Active ou désactive des modules pour cet établissement. Un module désactivé disparaît
        des menus et son accès est bloqué.
      </p>
      <div className="space-y-2">
        {MODULES.map((m) => (
          <label key={m.id} className="flex items-center justify-between rounded-xl border border-navy-900/10 px-4 py-3">
            <span>
              <span className="font-medium text-navy-900">{m.label}</span>
              <span className="ml-2 text-xs text-navy-900/50">{m.desc}</span>
            </span>
            <input type="checkbox" checked={actifs.has(m.id)} onChange={() => toggle(m.id)} className="h-5 w-5" />
          </label>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Bouton onClick={() => onSave([...actifs])}>Enregistrer</Bouton>
      </div>
    </Carte>
  );
}

function Matricule({ ecole, onSave }) {
  const [f, setF] = useState({ prefixe: "", separateur: "-", longueur: 4 });
  useEffect(() => {
    if (!ecole) return;
    setF({
      prefixe: ecole.matricule_prefixe ?? "",
      separateur: ecole.matricule_separateur ?? "-",
      longueur: ecole.matricule_longueur ?? 4,
    });
  }, [ecole]);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const aa = String(new Date().getFullYear() % 100).padStart(2, "0");
  const seq = "1".padStart(Math.max(1, Number(f.longueur) || 4), "0");
  const apercu = (f.prefixe ? f.prefixe + (f.separateur || "-") : "") + aa + (f.separateur || "-") + seq;
  return (
    <Carte className="p-6">
      <h3 className="mb-1 font-display text-lg font-semibold text-navy-900">Matricule des élèves</h3>
      <p className="mb-4 text-xs text-navy-900/40">Format : {"{PRÉFIXE}{SÉP}{AA}{SÉP}{SÉQUENCE}"}. La séquence repart à 1 chaque année.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Champ label="Préfixe" value={f.prefixe} onChange={(e) => maj("prefixe", e.target.value.toUpperCase())} placeholder="GS" />
        <Champ label="Séparateur" value={f.separateur} onChange={(e) => maj("separateur", e.target.value.slice(0, 1))} placeholder="-" />
        <Champ label="Chiffres" type="number" min="1" max="8" value={f.longueur} onChange={(e) => maj("longueur", e.target.value.replace(/\D/g, ""))} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy-900/60">Aperçu : <span className="font-mono text-base font-semibold text-navy-900">{apercu}</span></p>
        <Bouton onClick={() => onSave(f)}>Enregistrer</Bouton>
      </div>
    </Carte>
  );
}
