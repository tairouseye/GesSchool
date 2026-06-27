import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import { majEcole, majConfigMatricule } from "@/lib/academique.js";
import { MODULES, tousLesModules, moduleActif } from "@/lib/modules.js";
import { estRoleComplet } from "@/lib/permissions.js";
import * as relancesApi from "@/lib/relances.js";

const DEVISES = ["XOF", "XAF", "EUR", "USD", "GNF", "MAD"];

export default function Parametres() {
  const { ecoleId, ecole, roles, modulesActifs, rafraichirProfil } = useAuth();
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
        {moduleActif(modulesActifs, "recouvrement") && (
          <RelancesConfig ecoleId={ecoleId} estGestion={estRoleComplet(roles)} />
        )}
        <ModulesActifs ecole={ecole} onSave={(mods) => action(() => majEcole(ecoleId, { modules_actifs: mods }))} />
      </div>
    </>
  );
}

const MODELE_DEFAUT =
  "Rappel {ecole} : {montant} {devise} restent dus pour {eleve} (échéance {echeance}). Merci de régulariser.";

function RelancesConfig({ ecoleId, estGestion }) {
  const [regles, setRegles] = useState([]);
  const [edit, setEdit] = useState(null); // règle en cours d'édition / création
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");

  const recharger = useCallback(async () => {
    setErreur("");
    try { setRegles(await relancesApi.getRegles(ecoleId)); }
    catch (e) { setErreur(e.message); }
  }, [ecoleId]);

  useEffect(() => { recharger(); }, [recharger]);

  const wrap = async (fn, msg) => {
    setErreur(""); setInfo("");
    try { await fn(); await recharger(); if (msg) setInfo(msg); }
    catch (e) { setErreur(e.message); }
  };

  const lancerTout = () =>
    wrap(async () => {
      const n = await relancesApi.lancerTout();
      setInfo(`${n} relance(s) envoyée(s).`);
    });

  return (
    <Carte className="p-6">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-navy-900">Relances automatiques</h3>
        <Bouton variante="fantome" onClick={() => setEdit({ libelle: "", jours: 1, modele: MODELE_DEFAUT, actif: true })}>
          + Palier
        </Bouton>
      </div>
      <p className="mb-4 text-xs text-navy-900/40">
        Paliers déclenchés chaque jour pour les scolarités impayées (J = jours après l'échéance,
        négatif = avant). Le message part en notification + push aux parents. Variables :
        <span className="font-mono"> {relancesApi.VARIABLES_MODELE.join(" ")}</span>
      </p>

      <Alerte ton="erreur">{erreur}</Alerte>
      {info && <Alerte ton="succes">{info}</Alerte>}

      <div className="mt-3 space-y-2">
        {regles.length === 0 && (
          <p className="rounded-xl border border-dashed border-navy-900/15 px-4 py-6 text-center text-sm text-navy-900/40">
            Aucun palier. Ajoute un premier rappel pour activer les relances.
          </p>
        )}
        {regles.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-navy-900/10 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-navy-900">
                {r.libelle} <span className="ml-1 font-mono text-xs text-navy-900/50">J{r.jours >= 0 ? "+" : ""}{r.jours}</span>
              </p>
              <p className="truncate text-xs text-navy-900/40">{r.modele}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-navy-900/60">
                <input type="checkbox" checked={r.actif}
                  onChange={() => wrap(() => relancesApi.majRegle(r.id, { actif: !r.actif }))} />
                actif
              </label>
              <button onClick={() => setEdit(r)} className="text-xs font-medium text-navy-700 hover:text-or-500">éditer</button>
              <button onClick={() => confirm("Supprimer ce palier ?") && wrap(() => relancesApi.supprimerRegle(r.id), "Palier supprimé.")}
                className="text-xs font-medium text-rose-600 hover:text-rose-700">suppr.</button>
            </div>
          </div>
        ))}
      </div>

      {estGestion && regles.some((r) => r.actif) && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-creme px-4 py-3">
          <span className="text-xs text-navy-900/50">Forcer l'envoi de tous les rappels dus maintenant.</span>
          <Bouton variante="or" onClick={lancerTout}>Relancer tous les retards</Bouton>
        </div>
      )}

      <ModaleRegle
        regle={edit}
        onFermer={() => setEdit(null)}
        onValider={(vals) =>
          wrap(async () => {
            if (edit?.id) await relancesApi.majRegle(edit.id, vals);
            else await relancesApi.creerRegle(ecoleId, vals);
            setEdit(null);
          }, "Palier enregistré ✓")
        }
      />
    </Carte>
  );
}

function ModaleRegle({ regle, onFermer, onValider }) {
  const [f, setF] = useState({ libelle: "", jours: 1, modele: MODELE_DEFAUT, actif: true });
  useEffect(() => {
    if (!regle) return;
    setF({
      libelle: regle.libelle ?? "",
      jours: regle.jours ?? 1,
      modele: regle.modele ?? MODELE_DEFAUT,
      actif: regle.actif ?? true,
    });
  }, [regle]);
  if (!regle) return null;
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valide = f.libelle.trim() && f.modele.trim();

  return (
    <Modale ouvert={!!regle} onFermer={onFermer} titre={regle?.id ? "Modifier le palier" : "Nouveau palier"}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ label="Libellé" value={f.libelle} onChange={(e) => maj("libelle", e.target.value)} placeholder="1er rappel" />
          <Champ label="Jours après échéance" type="number" value={f.jours}
            onChange={(e) => maj("jours", parseInt(e.target.value, 10) || 0)} />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Message</span>
          <textarea rows={4} value={f.modele} onChange={(e) => maj("modele", e.target.value)}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none transition focus:border-or-500 focus:ring-2 focus:ring-or-500/20" />
        </label>
        <p className="text-xs text-navy-900/40">
          Variables : <span className="font-mono">{relancesApi.VARIABLES_MODELE.join(" ")}</span>
        </p>
        <div className="flex justify-end gap-2">
          <Bouton variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton onClick={() => valide && onValider(f)} disabled={!valide}>Enregistrer</Bouton>
        </div>
      </div>
    </Modale>
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
