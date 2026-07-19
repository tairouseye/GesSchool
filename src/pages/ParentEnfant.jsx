import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  enfantNotes, enfantFactures, enfantAbsences, enfantEmploi, enfantFournitures,
  ecolePaiementInfos, declarerPaiement, televerserPreuve, enfantDeclarations, justifierAbsenceParent,
  enfantBulletins, enfantBulletinLignes, demanderDocument, mesDemandes, TYPES_DOCUMENT,
  enfantCantine, enfantMenuCantine, enfantTransport,
} from "@/lib/parent.js";
import { JOURS } from "@/lib/emploi.js";
import { enfantCahier } from "@/lib/cahier.js";
import { Bouton, Champ, Carte, Alerte, Modale, SkeletonListe, Onglets } from "@/composants/ui.jsx";

const MODES_MOBILE = [["wave", "Wave"], ["orange_money", "Orange Money"], ["free_money", "Free Money"]];

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const hhmm = (t) => (t ? String(t).slice(0, 5) : "");

export default function ParentEnfant() {
  const { id } = useParams();
  const [onglet, setOnglet] = useState("notes");
  const [notes, setNotes] = useState([]);
  const [factures, setFactures] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [emploi, setEmploi] = useState([]);
  const [fournitures, setFournitures] = useState([]);
  const [infos, setInfos] = useState({});
  const [declarations, setDeclarations] = useState([]);
  const [cahier, setCahier] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [cantine, setCantine] = useState(null);
  const [menu, setMenu] = useState([]);
  const [transport, setTransport] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    try {
      const [n, f, a, e, four, inf, decl, cah, bul, dem, can, men, tra] = await Promise.all([
        enfantNotes(id), enfantFactures(id), enfantAbsences(id), enfantEmploi(id),
        enfantFournitures(id), ecolePaiementInfos(id), enfantDeclarations(id), enfantCahier(id), enfantBulletins(id), mesDemandes(),
        enfantCantine(id), enfantMenuCantine(id), enfantTransport(id),
      ]);
      setNotes(n); setFactures(f); setAbsences(a); setEmploi(e);
      setFournitures(four); setInfos(inf); setDeclarations(decl); setCahier(cah); setBulletins(bul); setDemandes(dem);
      setCantine(can); setMenu(men); setTransport(tra);
    } catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [id]);

  useEffect(() => { setChargement(true); charger(); }, [charger]);

  return (
    <div className="space-y-5">
      <Link to="/parent" className="text-sm text-navy-700 hover:text-or-500">← Mes enfants</Link>
      <Alerte ton="erreur">{erreur}</Alerte>

      <Onglets actif={onglet} onChange={setOnglet}
        items={[["notes", "Notes"], ["bulletins", "Bulletins"], ["cahier", "Cahier de textes"], ["emploi", "Emploi du temps"], ["fournitures", "Fournitures"], ["paiements", "Paiements"], ["absences", "Absences"], ["documents", "Documents"],
          ...(cantine ? [["cantine", "🍽️ Cantine"]] : []), ...(transport ? [["transport", "🚌 Transport"]] : [])]} />

      {chargement ? (
        <SkeletonListe lignes={4} />
      ) : onglet === "notes" ? (
        <Notes notes={notes} />
      ) : onglet === "bulletins" ? (
        <Bulletins bulletins={bulletins} onErreur={setErreur} />
      ) : onglet === "cahier" ? (
        <Cahier entrees={cahier} />
      ) : onglet === "emploi" ? (
        <Emploi creneaux={emploi} />
      ) : onglet === "fournitures" ? (
        <Fournitures items={fournitures} />
      ) : onglet === "paiements" ? (
        <Paiements factures={factures} infos={infos} declarations={declarations} eleveId={id} onChange={charger} onErreur={setErreur} />
      ) : onglet === "documents" ? (
        <Documents eleveId={id} demandes={demandes} onChange={charger} onErreur={setErreur} />
      ) : onglet === "cantine" ? (
        <CantineParent cantine={cantine} menu={menu} />
      ) : onglet === "transport" ? (
        <TransportParent transport={transport} />
      ) : (
        <Absences absences={absences} onChange={charger} onErreur={setErreur} />
      )}
    </div>
  );
}

const JOURS_SEM = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const LIB_TRAJET = { aller_retour: "Aller-retour", aller: "Aller seul", retour: "Retour seul" };

function CantineParent({ cantine, menu }) {
  return (
    <div className="space-y-4">
      <Carte className="p-5">
        <h3 className="font-display text-lg font-bold text-navy-900">🍽️ Cantine</h3>
        {!cantine ? (
          <p className="mt-1 text-sm text-navy-900/50">Aucun abonnement cantine.</p>
        ) : (
          <div className="mt-2 space-y-1 text-sm text-navy-900/70">
            <p>Formule : <b className="text-navy-900">{cantine.formule === "prepaye" ? "Prépayé (au repas)" : "Mensuel"}</b>{cantine.actif ? "" : " (inactif)"}</p>
            {cantine.formule === "prepaye"
              ? <p>Solde restant : <b className="text-navy-900">{fmt(cantine.solde)}</b></p>
              : <p>Tarif : <b>{fmt(cantine.tarif)}</b> / mois</p>}
            {cantine.regime && <p>Régime / allergies : <b>{cantine.regime}</b></p>}
          </div>
        )}
      </Carte>
      {menu.length > 0 && (
        <Carte className="p-5">
          <h4 className="mb-2 font-semibold text-navy-900">Menu de la semaine</h4>
          <ul className="space-y-1 text-sm text-navy-900/70">
            {menu.map((m) => <li key={m.jour}><b className="text-navy-900">{JOURS_SEM[m.jour]}</b> : {m.plats || "—"}</li>)}
          </ul>
        </Carte>
      )}
    </div>
  );
}

function TransportParent({ transport }) {
  if (!transport) return <Carte className="p-6 text-sm text-navy-900/50">Aucun abonnement transport.</Carte>;
  return (
    <Carte className="p-5">
      <h3 className="font-display text-lg font-bold text-navy-900">🚌 Transport scolaire</h3>
      <div className="mt-2 space-y-1 text-sm text-navy-900/70">
        <p>Circuit : <b className="text-navy-900">{transport.circuit || "—"}</b></p>
        <p>Arrêt : <b>{transport.arret || "—"}</b>{transport.heure_depart ? ` · départ ${transport.heure_depart}` : ""}</p>
        <p>Trajet : {LIB_TRAJET[transport.trajet] || transport.trajet}</p>
        {transport.chauffeur && <p>Chauffeur : {transport.chauffeur}{transport.chauffeur_tel ? ` · ${transport.chauffeur_tel}` : ""}</p>}
        <p>Tarif : <b>{fmt(transport.tarif)}</b> / mois</p>
      </div>
    </Carte>
  );
}

function Notes({ notes }) {
  if (notes.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune note pour l'instant.</Carte>;
  // Regroupe par période puis matière ; calcule la moyenne par matière (pondérée par coef d'éval, sur /20)
  const parPeriode = {};
  for (const n of notes) {
    const p = (parPeriode[n.periode] ||= { ordre: n.ordre, matieres: {} });
    const m = (p.matieres[n.matiere] ||= { sN: 0, sC: 0, notes: [] });
    const note20 = (Number(n.valeur) / (Number(n.bareme) || 20)) * 20;
    const c = Number(n.coefficient) || 1;
    m.sN += note20 * c; m.sC += c;
    m.notes.push({ type: n.type, valeur: n.valeur, bareme: n.bareme });
  }
  const periodes = Object.entries(parPeriode).sort((a, b) => a[1].ordre - b[1].ordre);

  return (
    <div className="space-y-5">
      {periodes.map(([periode, p]) => {
        const matieres = Object.entries(p.matieres);
        const moyGen = matieres.reduce((s, [, m]) => s + (m.sC ? m.sN / m.sC : 0), 0) / (matieres.length || 1);
        return (
          <Carte key={periode} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-navy-900/10 px-6 py-3">
              <h3 className="font-display font-semibold text-navy-900">{periode}</h3>
              <span className="text-sm text-navy-900/60">Moyenne : <span className="font-mono font-bold text-navy-900">{moyGen.toFixed(2)}</span>/20</span>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-creme text-navy-900/50">
                <tr><th className="px-6 py-2 font-medium">Matière</th><th className="px-6 py-2 font-medium">Notes</th><th className="px-6 py-2 text-right font-medium">Moyenne</th></tr>
              </thead>
              <tbody>
                {matieres.map(([matiere, m]) => (
                  <tr key={matiere} className="border-t border-navy-900/5">
                    <td className="px-6 py-2 font-medium text-navy-900">{matiere}</td>
                    <td className="px-6 py-2 font-mono text-xs text-navy-900/60">
                      {m.notes.map((x, i) => `${x.valeur}/${x.bareme}`).join(" · ")}
                    </td>
                    <td className="px-6 py-2 text-right font-mono">{m.sC ? (m.sN / m.sC).toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Carte>
        );
      })}
    </div>
  );
}

function Emploi({ creneaux }) {
  if (creneaux.length === 0) {
    return <Carte className="p-6 text-sm text-navy-900/40">Aucun emploi du temps disponible.</Carte>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {JOURS.map(([j, label]) => {
        const items = creneaux.filter((c) => c.jour === j);
        if (items.length === 0) return null;
        return (
          <Carte key={j} className="p-5">
            <h3 className="mb-3 font-display font-semibold text-navy-900">{label}</h3>
            <ul className="space-y-2">
              {items.map((c, i) => (
                <li key={i} className="rounded-xl border border-navy-900/10 p-3">
                  <p className="font-mono text-xs text-or-600">{hhmm(c.heure_debut)} – {hhmm(c.heure_fin)}</p>
                  <p className="font-medium text-navy-900">{c.matiere || "—"}</p>
                  <p className="text-xs text-navy-900/50">
                    {c.enseignant || ""}{c.salle ? ` · ${c.salle}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Carte>
        );
      })}
    </div>
  );
}

function Bulletins({ bulletins, onErreur }) {
  const [sel, setSel] = useState(null);
  const [lignes, setLignes] = useState([]);

  async function ouvrir(b) {
    try { setLignes(await enfantBulletinLignes(b.id)); setSel(b); }
    catch (e) { onErreur(e.message); }
  }

  if (bulletins.length === 0) {
    return <Carte className="p-6 text-sm text-navy-900/40">Aucun bulletin publié pour le moment.</Carte>;
  }
  return (
    <div className="space-y-2">
      {bulletins.map((b) => (
        <Carte key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-display font-semibold text-navy-900">{b.periode}</p>
            <p className="text-xs text-navy-900/50">
              Moyenne {b.moyenne != null ? Number(b.moyenne).toFixed(2) : "—"}/20
              {b.rang ? ` · Rang ${b.rang}${b.effectif ? "/" + b.effectif : ""}` : ""} · {b.mention || "—"}
            </p>
          </div>
          <Bouton variante="fantome" onClick={() => ouvrir(b)}>Voir / Imprimer</Bouton>
        </Carte>
      ))}

      <Modale ouvert={!!sel} onFermer={() => setSel(null)} titre="Bulletin" large>
        {sel && (
          <>
            <BulletinParent b={sel} lignes={lignes} />
            <div className="no-print mt-5 flex justify-end gap-2">
              <Bouton variante="fantome" onClick={() => setSel(null)}>Fermer</Bouton>
              <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
            </div>
          </>
        )}
      </Modale>
    </div>
  );
}

function BulletinParent({ b, lignes }) {
  const totalCoef = lignes.reduce((s, l) => s + Number(l.coefficient || 0), 0);
  return (
    <div className="zone-impression relative overflow-hidden rounded-xl border border-navy-900/10 bg-white p-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {b.logo && <img src={b.logo} alt="" className="h-14 w-14 shrink-0 object-contain" />}
          <div>
            <p className="font-display text-xl font-bold text-navy-900">Bulletin scolaire</p>
            <p className="text-sm text-navy-900/50">{b.ecole} — {b.periode}{b.annee ? ` · ${b.annee}` : ""}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold text-navy-900">{b.eleve_prenom} {b.eleve_nom}</p>
          <p className="text-sm text-navy-900/50">Classe {b.classe}</p>
          <p className="font-mono text-xs text-navy-900/40">{b.matricule}</p>
        </div>
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b border-navy-900/15 text-navy-900/50">
          <tr><th className="py-2 font-medium">Matière</th><th className="py-2 text-center font-medium">Moyenne</th><th className="py-2 text-center font-medium">Coef.</th><th className="py-2 text-center font-medium">Pts</th><th className="py-2 font-medium">Appréciation</th></tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i} className="border-b border-navy-900/5">
              <td className="py-2 font-medium text-navy-900">{l.matiere}</td>
              <td className="py-2 text-center font-mono">{l.moyenne != null ? Number(l.moyenne).toFixed(2) : "—"}</td>
              <td className="py-2 text-center font-mono text-navy-900/60">{l.coefficient}</td>
              <td className="py-2 text-center font-mono text-navy-900/60">{l.moyenne != null ? (Number(l.moyenne) * Number(l.coefficient)).toFixed(2) : "—"}</td>
              <td className="py-2 text-xs text-navy-900/70">{l.appreciation || ""}</td>
            </tr>
          ))}
          {lignes.length === 0 && <tr><td colSpan={5} className="py-3 text-navy-900/40">—</td></tr>}
        </tbody>
      </table>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-navy-900 p-4 text-creme">
          <p className="text-xs text-creme/60">Moyenne générale</p>
          <p className="font-display text-2xl font-bold">{b.moyenne != null ? Number(b.moyenne).toFixed(2) : "—"}<span className="text-sm font-normal">/20</span></p>
        </div>
        <div className="rounded-xl bg-or-500 p-4 text-navy-900">
          <p className="text-xs text-navy-900/60">Rang</p>
          <p className="font-display text-2xl font-bold">{b.rang ?? "—"}{b.effectif ? <span className="text-sm font-normal">/{b.effectif}</span> : ""}</p>
        </div>
        <div className="rounded-xl border border-navy-900/15 p-4">
          <p className="text-xs text-navy-900/50">Mention</p>
          <p className="font-display text-xl font-bold text-navy-900">{b.mention || "—"}</p>
        </div>
      </div>

      {(b.appreciation || b.decision) && (
        <div className="mt-6 space-y-2 rounded-xl border border-navy-900/10 bg-creme/40 p-4 text-sm">
          {b.appreciation && <p className="text-navy-900/80"><b className="text-navy-900/50">Appréciation générale :</b> {b.appreciation}</p>}
          {b.decision && <p className="text-navy-900/80"><b className="text-navy-900/50">Décision du conseil :</b> {b.decision}</p>}
        </div>
      )}

      <div className="mt-6 flex items-end justify-between text-xs text-navy-900/40">
        <span>Total coefficients : <span className="font-mono">{totalCoef}</span></span>
        <span>{b.ecole} · {b.sigle}</span>
      </div>
    </div>
  );
}

function Documents({ eleveId, demandes, onChange, onErreur }) {
  const [type, setType] = useState("scolarite");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const fmtD = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "");
  const lib = { en_attente: "En attente", en_cours: "En cours", pret: "Prêt ✓", rejete: "Rejeté" };
  const ton = { en_attente: "text-or-600", en_cours: "text-navy-900/60", pret: "text-emerald-700", rejete: "text-rose-600" };
  const typeLib = Object.fromEntries(TYPES_DOCUMENT);

  async function envoyer() {
    if (!type) return;
    setEnvoi(true); onErreur("");
    try { await demanderDocument(eleveId, type, message.trim()); setMessage(""); await onChange(); }
    catch (e) { onErreur(e.message); }
    finally { setEnvoi(false); }
  }

  return (
    <div className="space-y-4">
      <Carte className="p-5">
        <h3 className="mb-3 font-display font-semibold text-navy-900">Demander un document</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type de document</span>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {TYPES_DOCUMENT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Précisions (optionnel)</span>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Motif, urgence…"
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Bouton onClick={envoyer} disabled={envoi}>{envoi ? "Envoi…" : "Envoyer la demande"}</Bouton>
        </div>
      </Carte>

      {demandes.length > 0 && (
        <Carte className="p-5">
          <h3 className="mb-2 font-display font-semibold text-navy-900">Mes demandes</h3>
          <ul className="divide-y divide-navy-900/5">
            {demandes.map((d) => (
              <li key={d.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-navy-900">{typeLib[d.type] || d.type} <span className="text-xs text-navy-900/40">· {d.eleve} · {fmtD(d.created_at)}</span></span>
                  <span className={`text-xs font-medium ${ton[d.statut] || ""}`}>{lib[d.statut] || d.statut}</span>
                </div>
                {d.reponse && <p className="mt-0.5 text-xs text-navy-900/50">Réponse : {d.reponse}</p>}
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </div>
  );
}

function Cahier({ entrees }) {
  if (entrees.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune entrée dans le cahier de textes.</Carte>;
  const fmtD = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" }) : "");
  return (
    <div className="space-y-3">
      {entrees.map((e, i) => (
        <Carte key={i} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-or-600">{fmtD(e.date_seance)}</span>
            {e.matiere && <span className="rounded-full bg-navy-900/5 px-2.5 py-0.5 text-xs font-medium text-navy-900/70">{e.matiere}</span>}
          </div>
          {e.contenu && <p className="mt-2 whitespace-pre-wrap text-sm text-navy-900/80">{e.contenu}</p>}
          {e.devoirs && (
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-navy-900/80">
              <b className="text-or-600">📘 Devoirs :</b> {e.devoirs}
              {e.date_pour && <span className="ml-1 text-xs text-navy-900/50">(pour le {fmtD(e.date_pour)})</span>}
            </p>
          )}
        </Carte>
      ))}
    </div>
  );
}

function Fournitures({ items }) {
  if (items.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune liste de fournitures publiée.</Carte>;
  return (
    <Carte className="p-6">
      <h3 className="mb-3 font-display font-semibold text-navy-900">Liste des fournitures</h3>
      <ul className="divide-y divide-navy-900/5">
        {items.map((f, i) => (
          <li key={i} className="flex items-center justify-between py-2 text-sm">
            <span className="text-navy-900">
              <span className="font-mono text-xs text-or-600">×{f.quantite}</span>{" "}
              <span className="font-medium">{f.libelle}</span>
              {!f.obligatoire && <span className="ml-2 text-xs text-navy-900/40">(optionnel)</span>}
              {f.note && <span className="ml-2 text-xs text-navy-900/50">— {f.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Carte>
  );
}

function Paiements({ factures, infos, declarations, eleveId, onChange, onErreur }) {
  const [payer, setPayer] = useState(null); // facture à régler
  if (factures.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune facture.</Carte>;
  const totalReste = factures.reduce((s, f) => s + ((Number(f.montant_total) || 0) - (Number(f.montant_paye) || 0)), 0);
  const aDesNumeros = MODES_MOBILE.some(([k]) => infos?.[k]);
  const statutLib = { en_attente: "En attente", valide: "Validé", rejete: "Rejeté" };
  const statutTon = { en_attente: "text-or-600", valide: "text-emerald-700", rejete: "text-rose-600" };

  return (
    <div className="space-y-4">
      <Carte className="p-5">
        <p className="text-sm text-navy-900/50">Reste à payer</p>
        <p className="mt-1 font-display text-2xl font-bold text-navy-900">{fmt(totalReste)} <span className="text-sm font-normal">XOF</span></p>
      </Carte>

      <Carte className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-creme text-navy-900/50">
            <tr><th className="px-4 py-2 font-medium">N°</th><th className="px-4 py-2 font-medium">Échéance</th><th className="px-4 py-2 text-right font-medium">Reste</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {factures.map((f) => {
              const reste = (Number(f.montant_total) || 0) - (Number(f.montant_paye) || 0);
              return (
                <tr key={f.id} className="border-t border-navy-900/5">
                  <td className="px-4 py-2 font-mono text-xs">{f.numero}</td>
                  <td className="px-4 py-2 font-mono text-xs">{f.date_echeance || "—"}</td>
                  <td className={`px-4 py-2 text-right font-mono ${reste > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(reste)}</td>
                  <td className="px-4 py-2 text-right">
                    {reste > 0 && aDesNumeros && (
                      <button onClick={() => setPayer({ ...f, reste })} className="rounded-lg bg-navy-900 px-3 py-1 text-xs font-medium text-creme">Payer</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Carte>

      {!aDesNumeros && (
        <p className="text-xs text-navy-900/40">Le paiement mobile n'est pas encore configuré par l'établissement.</p>
      )}

      {declarations.length > 0 && (
        <Carte className="p-5">
          <h3 className="mb-2 font-display font-semibold text-navy-900">Mes déclarations</h3>
          <ul className="space-y-1 text-sm">
            {declarations.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span className="text-navy-900/70">{d.numero} · {fmt(d.montant)} XOF</span>
                <span className={`text-xs font-medium ${statutTon[d.statut]}`}>{statutLib[d.statut] || d.statut}</span>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      <ModalePayer
        facture={payer} infos={infos} eleveId={eleveId}
        onFermer={() => setPayer(null)}
        onDeclare={async (data) => {
          try {
            const preuve = data.fichier ? await televerserPreuve(eleveId, data.fichier) : null;
            await declarerPaiement(payer.id, data.montant, data.mode, data.reference, preuve);
            setPayer(null);
            await onChange();
          } catch (e) { onErreur(e.message); }
        }}
      />
    </div>
  );
}

function ModalePayer({ facture, infos, onFermer, onDeclare }) {
  const [mode, setMode] = useState("wave");
  const [montant, setMontant] = useState("");
  const [reference, setReference] = useState("");
  const [fichier, setFichier] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (facture) { setMontant(String(Math.round(facture.reste || 0))); setReference(""); setMode("wave"); setFichier(null); }
  }, [facture]);

  if (!facture) return null;
  const numero = infos?.[mode];

  return (
    <Modale ouvert={!!facture} onFermer={onFermer} titre={`Payer la facture ${facture.numero}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-creme p-4 text-sm">
          <p className="text-navy-900/60">1. Paie depuis ton application mobile money sur le numéro de l'école :</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODES_MOBILE.map(([k, label]) => infos?.[k] && (
              <button key={k} onClick={() => setMode(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === k ? "bg-navy-900 text-creme" : "bg-white text-navy-900/70 border border-navy-900/15"}`}>
                {label}
              </button>
            ))}
          </div>
          {numero && (
            <p className="mt-3 font-display text-xl font-bold text-navy-900">{numero}</p>
          )}
          <p className="mt-1 text-xs text-navy-900/50">Référence à indiquer : <span className="font-mono">{facture.numero}</span></p>
        </div>

        <p className="text-sm text-navy-900/60">2. Déclare ton paiement, l'école le validera :</p>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Montant payé" value={montant} onChange={(e) => setMontant(e.target.value.replace(/[^0-9]/g, ""))} />
          <Champ label="Réf. transaction" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ID Wave/OM…" />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Preuve de paiement <span className="text-navy-900/40">(capture / photo — optionnel)</span></span>
          <input type="file" accept="image/*,application/pdf"
            onChange={(e) => setFichier(e.target.files?.[0] || null)}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900/5 file:px-3 file:py-2 file:text-sm" />
          {fichier && <span className="mt-1 block text-xs text-emerald-700">📎 {fichier.name}</span>}
        </label>

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton
            disabled={envoi || !montant}
            onClick={async () => { setEnvoi(true); await onDeclare({ montant: Number(montant), mode, reference, fichier }); setEnvoi(false); }}
          >
            {envoi ? "Envoi…" : "Déclarer le paiement"}
          </Bouton>
        </div>
      </div>
    </Modale>
  );
}

function Absences({ absences, onChange, onErreur }) {
  const [justif, setJustif] = useState(null); // absence à justifier
  if (absences.length === 0) return <Carte className="p-6 text-sm text-navy-900/40">Aucune absence enregistrée 🎉</Carte>;
  const lib = { non_justifie: "Non justifié", en_attente: "En attente", justifie: "Justifié" };
  const ton = { non_justifie: "text-rose-600", en_attente: "text-or-600", justifie: "text-emerald-700" };
  return (
    <div className="space-y-2">
      {absences.map((a, i) => (
        <Carte key={a.id || i} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-mono text-xs text-navy-900/50">{a.date_abs}</span>{" "}
              <span className="font-medium text-navy-900 capitalize">{a.type === "retard" ? "Retard" : "Absence"}</span>
              {a.motif && <span className="text-navy-900/50"> · {a.motif}</span>}
            </p>
            {a.justification && <p className="mt-0.5 text-xs text-navy-900/50">Votre justification : « {a.justification} »</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${ton[a.statut] || ""}`}>{lib[a.statut] || a.statut}</span>
            {a.statut === "non_justifie" && (
              <button onClick={() => setJustif(a)} className="rounded-lg bg-navy-900 px-3 py-1 text-xs font-medium text-creme">Justifier</button>
            )}
          </div>
        </Carte>
      ))}

      <ModaleJustif
        absence={justif} onFermer={() => setJustif(null)}
        onEnvoyer={async (texte) => {
          try { await justifierAbsenceParent(justif.id, texte); setJustif(null); await onChange(); }
          catch (e) { onErreur(e.message); }
        }}
      />
    </div>
  );
}

function ModaleJustif({ absence, onFermer, onEnvoyer }) {
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => { if (absence) setTexte(""); }, [absence]);
  if (!absence) return null;
  return (
    <Modale ouvert={!!absence} onFermer={onFermer} titre={`Justifier l'absence du ${absence.date_abs}`}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Motif de l'absence</span>
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3}
            placeholder="Ex. : enfant malade, rendez-vous médical…"
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500" />
        </label>
        <p className="text-xs text-navy-900/40">Votre justification sera transmise à l'établissement pour validation.</p>
        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton disabled={envoi || !texte.trim()}
            onClick={async () => { setEnvoi(true); await onEnvoyer(texte.trim()); setEnvoi(false); }}>
            {envoi ? "…" : "Envoyer"}
          </Bouton>
        </div>
      </div>
    </Modale>
  );
}
