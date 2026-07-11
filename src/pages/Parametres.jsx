import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import { majEcole, majConfigMatricule, televerserAsset, getSignataires, setSignataires, getChampsEleve, setChampsEleve } from "@/lib/academique.js";
import { MODULES, tousLesModules, moduleActif } from "@/lib/modules.js";
import { estRoleComplet } from "@/lib/permissions.js";
import { getMembres } from "@/lib/membres.js";
import { getNotationConfig, setNotationConfig, DEFAUT_NOTATION } from "@/lib/bulletins.js";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
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

        <ProfilEcole ecoleId={ecoleId} ecole={ecole} onSave={(v) => action(() => majEcole(ecoleId, v))} onErreur={setErreur} />
        <Signataires ecoleId={ecoleId} onErreur={setErreur} />
        <NotationConfig ecoleId={ecoleId} onErreur={setErreur} />
        <ChampsEleveConfig ecoleId={ecoleId} onErreur={setErreur} />
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
  const confirmer = useConfirm();
  const toast = useToast();
  const [regles, setRegles] = useState([]);
  const [edit, setEdit] = useState(null); // règle en cours d'édition / création
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    setErreur("");
    try { setRegles(await relancesApi.getRegles(ecoleId)); }
    catch (e) { setErreur(e.message); }
  }, [ecoleId]);

  useEffect(() => { recharger(); }, [recharger]);

  const wrap = async (fn, msg) => {
    try { await fn(); await recharger(); if (msg) toast.succes(msg); return true; }
    catch (e) { toast.erreur(e.message || "Une erreur est survenue."); return false; }
  };

  const lancerTout = () =>
    wrap(async () => {
      const n = await relancesApi.lancerTout();
      toast.succes(`${n} relance(s) envoyée(s).`);
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
              <button onClick={async () => { if (await confirmer("Supprimer ce palier ?")) wrap(() => relancesApi.supprimerRegle(r.id), "Palier supprimé."); }}
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

function ProfilEcole({ ecoleId, ecole, onSave, onErreur }) {
  const [f, setF] = useState({ nom: "", sigle: "", devise: "XOF", couleur_primaire: "#0B1F3A", couleur_secondaire: "#C9A227", logo_url: null, cachet_url: null });
  const [up, setUp] = useState("");
  useEffect(() => {
    if (!ecole) return;
    setF({
      nom: ecole.nom || "", sigle: ecole.sigle || "", devise: ecole.devise || "XOF",
      couleur_primaire: ecole.couleur_primaire || "#0B1F3A",
      couleur_secondaire: ecole.couleur_secondaire || "#C9A227",
      logo_url: ecole.logo_url || null, cachet_url: ecole.cachet_url || null,
    });
  }, [ecole]);
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function televerser(champ, file, prefixe) {
    if (!file) return;
    setUp(champ); onErreur?.("");
    try { maj(champ, await televerserAsset(ecoleId, file, prefixe)); }
    catch (e) { onErreur?.(e.message); }
    finally { setUp(""); }
  }

  return (
    <Carte className="p-6">
      <h3 className="mb-4 font-display text-lg font-semibold text-navy-900">Établissement</h3>

      {/* Logo & cachet */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AssetUpload label="Logo de l'école" valeur={f.logo_url} occupe={up === "logo_url"}
          onFichier={(file) => televerser("logo_url", file, "logo")} onRetirer={() => maj("logo_url", null)} />
        <AssetUpload label="Cachet (image)" valeur={f.cachet_url} occupe={up === "cachet_url"}
          onFichier={(file) => televerser("cachet_url", file, "cachet")} onRetirer={() => maj("cachet_url", null)} />
      </div>

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

function AssetUpload({ label, valeur, occupe, onFichier, onRetirer }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-navy-900/70">{label}</span>
      <div className="flex items-center gap-3 rounded-xl border border-navy-900/10 p-3">
        {valeur
          ? <img src={valeur} alt="" className="h-12 w-12 rounded object-contain ring-1 ring-navy-900/10" />
          : <span className="grid h-12 w-12 place-items-center rounded bg-navy-900/5 text-xs text-navy-900/30">—</span>}
        <div className="flex-1 text-xs">
          <label className="cursor-pointer text-navy-700 hover:text-or-500">
            {occupe ? "Envoi…" : valeur ? "Changer l'image" : "Téléverser une image"}
            <input type="file" accept="image/*" className="hidden" disabled={occupe}
              onChange={(e) => e.target.files?.[0] && onFichier(e.target.files[0])} />
          </label>
          {valeur && <button onClick={onRetirer} className="ml-3 text-rose-500 hover:underline">retirer</button>}
        </div>
      </div>
    </div>
  );
}

const TYPES_CHAMP = [["texte", "Texte"], ["nombre", "Nombre"], ["date", "Date"], ["liste", "Liste de choix"]];
const slugChamp = (s) => ((s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "champ");

function ChampsEleveConfig({ ecoleId, onErreur }) {
  const [liste, setListe] = useState([]);
  const [f, setF] = useState({ libelle: "", type: "texte", options: "" });
  const [info, setInfo] = useState("");
  useEffect(() => { getChampsEleve(ecoleId).then(setListe).catch((e) => onErreur?.(e.message)); }, [ecoleId]); // eslint-disable-line

  async function sauver(nouvelle) {
    setInfo("");
    try { await setChampsEleve(ecoleId, nouvelle); setListe(nouvelle); setInfo("Enregistré ✓"); }
    catch (e) { onErreur?.(e.message); }
  }
  function ajouter() {
    if (!f.libelle.trim()) return;
    const champ = { cle: `${slugChamp(f.libelle)}_${Math.random().toString(36).slice(2, 6)}`, libelle: f.libelle.trim(), type: f.type };
    if (f.type === "liste") champ.options = f.options.split(",").map((o) => o.trim()).filter(Boolean);
    sauver([...liste, champ]);
    setF({ libelle: "", type: "texte", options: "" });
  }

  return (
    <Carte className="p-6">
      <h3 className="mb-1 font-display text-lg font-semibold text-navy-900">Champs élève personnalisés</h3>
      <p className="mb-4 text-xs text-navy-900/40">
        Ajoutez des informations propres à votre école (ex. groupe sanguin, personne à contacter…). Elles apparaissent sur la <b>fiche élève</b>.
      </p>
      {info && <p className="mb-2 text-sm text-emerald-600">{info}</p>}

      <div className="space-y-2">
        {liste.length === 0 && <p className="text-sm text-navy-900/40">Aucun champ personnalisé.</p>}
        {liste.map((c, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-navy-900/10 px-4 py-2">
            <span className="text-sm">
              <b className="text-navy-900">{c.libelle}</b>
              <span className="ml-2 text-xs text-navy-900/40">· {TYPES_CHAMP.find((t) => t[0] === c.type)?.[1]}{c.type === "liste" && c.options?.length ? ` (${c.options.join(", ")})` : ""}</span>
            </span>
            <button onClick={() => sauver(liste.filter((_, j) => j !== i))} className="text-xs text-rose-500 hover:underline">retirer</button>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Champ label="Libellé du champ" value={f.libelle} onChange={(e) => setF((s) => ({ ...s, libelle: e.target.value }))} placeholder="Ex. Groupe sanguin" />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type</span>
          <select value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
            {TYPES_CHAMP.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {f.type === "liste" && (
          <Champ label="Options (séparées par des virgules)" value={f.options} onChange={(e) => setF((s) => ({ ...s, options: e.target.value }))} placeholder="A+, A-, B+, O-…" />
        )}
      </div>
      <div className="mt-3 flex justify-end"><Bouton onClick={ajouter} disabled={!f.libelle.trim()}>+ Ajouter</Bouton></div>
    </Carte>
  );
}

function NotationConfig({ ecoleId, onErreur }) {
  const [cfg, setCfg] = useState(DEFAUT_NOTATION);
  const [info, setInfo] = useState("");
  useEffect(() => { getNotationConfig(ecoleId).then(setCfg).catch((e) => onErreur?.(e.message)); }, [ecoleId]); // eslint-disable-line

  const maj = (k, v) => setCfg((s) => ({ ...s, [k]: v }));
  const majMention = (i, k, v) => setCfg((s) => ({ ...s, mentions: s.mentions.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));

  async function sauver() {
    setInfo("");
    try {
      const clean = {
        ...cfg,
        bareme: Number(cfg.bareme) || 20,
        moyenne_passage: Number(cfg.moyenne_passage) || 0,
        mentions: (cfg.mentions || []).filter((m) => (m.libelle || "").trim())
          .map((m) => ({ min: Number(m.min) || 0, libelle: m.libelle.trim() }))
          .sort((a, b) => b.min - a.min),
      };
      await setNotationConfig(ecoleId, clean);
      setCfg(clean); setInfo("Enregistré ✓");
    } catch (e) { onErreur?.(e.message); }
  }

  return (
    <Carte className="p-6">
      <h3 className="mb-1 font-display text-lg font-semibold text-navy-900">Notation &amp; bulletins</h3>
      <p className="mb-4 text-xs text-navy-900/40">
        Barème, moyenne de passage, mentions et options d'affichage. <b>Recalculez</b> les bulletins après un changement.
      </p>
      {info && <p className="mb-2 text-sm text-emerald-600">{info}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Champ label="Barème (moyennes sur…)" type="number" value={cfg.bareme} onChange={(e) => maj("bareme", e.target.value)} />
        <Champ label="Moyenne de passage" type="number" value={cfg.moyenne_passage} onChange={(e) => maj("moyenne_passage", e.target.value)} />
      </div>

      <p className="mb-1 mt-4 text-sm font-medium text-navy-900/70">Mentions (seuil ≥ → libellé)</p>
      <div className="space-y-2">
        {(cfg.mentions || []).map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="number" value={m.min} onChange={(e) => majMention(i, "min", e.target.value)}
              className="w-20 rounded-xl border border-navy-900/15 px-3 py-2 text-sm outline-none focus:border-or-500" />
            <input value={m.libelle} onChange={(e) => majMention(i, "libelle", e.target.value)} placeholder="Mention (ex. Très Bien)"
              className="flex-1 rounded-xl border border-navy-900/15 px-3 py-2 text-sm outline-none focus:border-or-500" />
            <button onClick={() => setCfg((s) => ({ ...s, mentions: s.mentions.filter((_, j) => j !== i) }))} className="text-xs text-rose-500 hover:underline">retirer</button>
          </div>
        ))}
        <button onClick={() => setCfg((s) => ({ ...s, mentions: [...(s.mentions || []), { min: 0, libelle: "" }] }))}
          className="text-xs text-navy-700 hover:text-or-500">+ Ajouter une mention</button>
        <p className="text-xs text-navy-900/40">En dessous du plus petit seuil : « {cfg.insuffisant || "Insuffisant"} ».</p>
      </div>

      <p className="mb-1 mt-4 text-sm font-medium text-navy-900/70">Affichage du bulletin</p>
      <div className="flex flex-wrap gap-4 text-sm text-navy-900/70">
        {[["afficher_rang", "Rang"], ["afficher_appreciations", "Appréciations"], ["afficher_decision", "Décision du conseil"]].map(([k, l]) => (
          <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={cfg[k] !== false} onChange={(e) => maj(k, e.target.checked)} /> {l}</label>
        ))}
      </div>

      <div className="mt-4 flex justify-end"><Bouton onClick={sauver}>Enregistrer</Bouton></div>
    </Carte>
  );
}

function Signataires({ ecoleId, onErreur }) {
  const [liste, setListe] = useState([]);
  const [membres, setMembres] = useState([]);
  const [f, setF] = useState({ fonction: "", nom: "", signature_url: null, profil_id: "" });
  const [up, setUp] = useState(false);
  const [info, setInfo] = useState("");

  const recharger = useCallback(async () => {
    try {
      setListe(await getSignataires(ecoleId));
      try { setMembres(await getMembres()); } catch { /* pas manager : liste vide */ }
    } catch (e) { onErreur?.(e.message); }
  }, [ecoleId]); // eslint-disable-line

  useEffect(() => { recharger(); }, [recharger]);
  const nomMembre = (id) => { const m = membres.find((x) => x.id === id); return m ? `${m.prenom} ${m.nom}`.trim() || m.email : ""; };

  async function sauver(nouvelle) {
    setInfo("");
    try { await setSignataires(ecoleId, nouvelle); setListe(nouvelle); setInfo("Enregistré ✓"); }
    catch (e) { onErreur?.(e.message); }
  }
  async function uploadSig(file) {
    if (!file) return;
    setUp(true); onErreur?.("");
    try { const url = await televerserAsset(ecoleId, file, "signature"); setF((s) => ({ ...s, signature_url: url })); }
    catch (e) { onErreur?.(e.message); }
    finally { setUp(false); }
  }
  function ajouter() {
    if (!f.fonction.trim()) return;
    sauver([...liste, {
      fonction: f.fonction.trim(), nom: f.nom.trim(), signature_url: f.signature_url,
      profil_id: f.profil_id || null, profil_nom: f.profil_id ? nomMembre(f.profil_id) : null,
    }]);
    setF({ fonction: "", nom: "", signature_url: null, profil_id: "" });
  }

  return (
    <Carte className="p-6">
      <h3 className="mb-1 font-display text-lg font-semibold text-navy-900">Signataires</h3>
      <p className="mb-4 text-xs text-navy-900/40">
        Responsables et leur signature scannée — proposés sur les documents officiels (certificats, bulletins…).
      </p>
      {info && <p className="mb-2 text-sm text-emerald-600">{info}</p>}

      <div className="space-y-2">
        {liste.length === 0 && <p className="text-sm text-navy-900/40">Aucun signataire.</p>}
        {liste.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-navy-900/10 px-4 py-2">
            <div className="flex items-center gap-3">
              {s.signature_url
                ? <img src={s.signature_url} alt="" className="h-8 w-24 rounded object-contain" />
                : <span className="text-xs text-navy-900/30">(sans signature)</span>}
              <span className="text-sm">
                <b className="text-navy-900">{s.fonction}</b>{s.nom ? ` — ${s.nom}` : ""}
                {s.profil_id
                  ? <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700">compte : {s.profil_nom || nomMembre(s.profil_id) || "lié"}</span>
                  : <span className="ml-2 rounded bg-navy-900/5 px-1.5 py-0.5 text-[10px] text-navy-900/40">sans compte (ne peut pas valider)</span>}
              </span>
            </div>
            <button onClick={() => sauver(liste.filter((_, j) => j !== i))} className="text-xs text-rose-500 hover:underline">retirer</button>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Champ label="Fonction *" value={f.fonction} onChange={(e) => setF((s) => ({ ...s, fonction: e.target.value }))} placeholder="Le Directeur" />
        <Champ label="Nom (optionnel)" value={f.nom} onChange={(e) => setF((s) => ({ ...s, nom: e.target.value }))} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Compte (pour valider les documents)</span>
          <select value={f.profil_id} onChange={(e) => setF((s) => ({ ...s, profil_id: e.target.value }))}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">— Aucun —</option>
            {membres.map((m) => <option key={m.id} value={m.id}>{m.prenom} {m.nom}{m.email ? ` (${m.email})` : ""}</option>)}
          </select>
        </label>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Signature</span>
          <div className="flex items-center gap-2 rounded-xl border border-navy-900/10 p-2">
            {f.signature_url && <img src={f.signature_url} alt="" className="h-8 w-16 object-contain" />}
            <label className="cursor-pointer text-xs text-navy-700 hover:text-or-500">
              {up ? "Envoi…" : f.signature_url ? "Changer" : "Téléverser"}
              <input type="file" accept="image/*" className="hidden" disabled={up}
                onChange={(e) => e.target.files?.[0] && uploadSig(e.target.files[0])} />
            </label>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Bouton onClick={ajouter} disabled={!f.fonction.trim()}>+ Ajouter</Bouton>
      </div>
    </Carte>
  );
}
