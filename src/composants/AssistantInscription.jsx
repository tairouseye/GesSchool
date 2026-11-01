import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Bouton, Champ, Alerte, Modale } from "@/composants/ui.jsx";
import * as api from "@/lib/eleves.js";
import * as pay from "@/lib/paiements.js";
import { getNiveaux } from "@/lib/academique.js";
import { genererCodeTuteur } from "@/lib/parent.js";
import { getComptes } from "@/lib/comptabilite.js";
import { peutVoir } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";
import { motifTelephone } from "@/lib/recherche.js";
import { lienWhatsApp } from "@/lib/recouvrement.js";
import { motEleve } from "@/lib/lexique.js";
import { doublonsPossibles, fraisApplicables, fraisParDefaut, messageCodeParent } from "@/lib/inscription.js";
import { facturesAEncaisser, resteFacture } from "@/lib/encaisser.js";

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const ETAPES = ["Élève", "Famille", "Frais", "Code parent"];
const SELECT = "w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500";

// Assistant d'inscription (lot 5 de l'audit du 31/10/2026, P2-12) :
// Élève → Famille → Frais et premier paiement → Code parent imprimable.
//
// 🔴 RIEN N'EST CRÉÉ AVANT LA FIN DE L'ÉTAPE 2. Abandonner en route ne laisse
// pas d'élève à moitié saisi. Ensuite, chaque création est mémorisée : si
// l'une échoue, « Réessayer » reprend là où l'on s'est arrêté, sans recréer
// l'élève.
export default function AssistantInscription({ ouvert, onFermer, ecoleId, sigle, annee, classes, onCree }) {
  const { ecole, roles, modulesActifs } = useAuth();
  const M = motEleve(ecole?.type_etablissement);
  const devise = ecole?.devise || "XOF";
  const voitFrais = peutVoir(roles, "paiements") && moduleActif(modulesActifs, "paiements");
  const voitCodes = peutVoir(roles, "codes_parents");

  const vide = { prenom: "", nom: "", sexe: "", date_naissance: "", lieu_naissance: "", classe_id: "" };
  const [etape, setEtape] = useState(0);
  const [f, setF] = useState(vide);
  const [doublons, setDoublons] = useState(null);       // null : pas vérifié · [] : aucun
  const [famille, setFamille] = useState({ tel: "", prenom: "", nom: "", lien: "Parent", tuteurExistant: null, aucun: false });
  const [connus, setConnus] = useState([]);             // parents déjà connus pour ce téléphone
  const [cree, setCree] = useState({ eleve: null, inscrit: false, tuteur: null }); // ce qui est déjà écrit
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    setEtape(0); setF(vide); setDoublons(null); setErreur(""); setConnus([]);
    setFamille({ tel: "", prenom: "", nom: "", lien: "Parent", tuteurExistant: null, aucun: false });
    setCree({ eleve: null, inscrit: false, tuteur: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  const maj = (k, v) => { setF((s) => ({ ...s, [k]: v })); if (["prenom", "nom", "date_naissance"].includes(k)) setDoublons(null); };
  const majFam = (k, v) => setFamille((s) => ({ ...s, [k]: v }));

  //  Un parent déjà connu de l'école (fratrie) : retrouvé par son téléphone.
  useEffect(() => {
    const motif = motifTelephone(famille.tel);
    if (!ouvert || etape !== 1 || !motif || motif.length < 15) { setConnus([]); return undefined; }
    let vivant = true;
    const t = setTimeout(() => {
      api.tuteursParTelephone(ecoleId, motif).then((l) => { if (vivant) setConnus(l); }).catch(() => {});
    }, 300);
    return () => { vivant = false; clearTimeout(t); };
  }, [ouvert, etape, famille.tel, ecoleId]);

  // --- Étape 1 → 2 : contrôle des doublons ---
  async function suivantEleve(e) {
    e.preventDefault();
    setErreur("");
    if (doublons === null) {
      setEnCours(true);
      try {
        const d = doublonsPossibles(await api.elevesHomonymes(ecoleId, f.nom.trim()), f);
        setDoublons(d);
        if (d.length > 0) return; // on montre, et on attend un choix explicite
      } catch (er) { setErreur(er.message); return; }
      finally { setEnCours(false); }
    }
    setEtape(1);
  }

  // --- Fin de l'étape 2 : les créations, mémorisées une à une ---
  async function creer() {
    setErreur(""); setEnCours(true);
    let etat = { ...cree };
    try {
      if (!etat.eleve) {
        const matricule = await api.genererMatricule(ecoleId, sigle);
        etat.eleve = await api.creerEleve(ecoleId, {
          matricule, prenom: f.prenom.trim(), nom: f.nom.trim(), sexe: f.sexe || null,
          date_naissance: f.date_naissance || null, lieu_naissance: f.lieu_naissance.trim() || null,
        });
        setCree({ ...etat });
      }
      if (f.classe_id && annee && !etat.inscrit) {
        await api.inscrire(ecoleId, etat.eleve.id, f.classe_id, annee.id);
        etat.inscrit = true; setCree({ ...etat });
      }
      if (!famille.aucun && !etat.tuteur) {
        const lien = { lien_parente: famille.lien || null, responsable_legal: true, responsable_paiement: true };
        if (famille.tuteurExistant) {
          await api.lierTuteur(ecoleId, etat.eleve.id, famille.tuteurExistant.id, lien);
          etat.tuteur = famille.tuteurExistant;
        } else if (famille.prenom.trim() && famille.nom.trim()) {
          etat.tuteur = await api.ajouterTuteur(ecoleId, etat.eleve.id,
            { prenom: famille.prenom.trim(), nom: famille.nom.trim(), telephone: famille.tel.trim() }, lien);
        }
        setCree({ ...etat });
      }
      onCree?.();
      setEtape(voitFrais && f.classe_id ? 2 : 3);
    } catch (er) {
      setErreur(etat.eleve
        ? `${f.prenom} est bien enregistré${f.sexe === "F" ? "e" : ""}, mais l'étape suivante a échoué : ${er.message}. « Réessayer » reprend sans le recréer.`
        : er.message);
    } finally { setEnCours(false); }
  }

  if (!ouvert) return null;
  const classe = classes.find((c) => c.id === f.classe_id);
  const nomEleve = `${f.prenom} ${f.nom}`.trim();
  const peutCreer = famille.aucun || famille.tuteurExistant || (famille.prenom.trim() && famille.nom.trim());

  return (
    <Modale ouvert onFermer={onFermer} titre={`Inscrire un ${M}`} large>
      <ol className="mb-5 flex flex-wrap gap-2 text-xs font-medium" aria-label="Étapes">
        {ETAPES.map((l, i) => (
          <li key={l} aria-current={i === etape ? "step" : undefined}
            className={`rounded-full px-3 py-1 ${i === etape ? "bg-navy-900 text-creme" : i < etape ? "bg-emerald-50 text-emerald-700" : "bg-navy-900/5 text-navy-900/60"}`}>
            {i < etape ? "✓ " : `${i + 1}. `}{l}
          </li>
        ))}
      </ol>
      <div className="mb-4"><Alerte ton="erreur">{erreur}</Alerte></div>

      {etape === 0 && (
        <form onSubmit={suivantEleve} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Champ label="Prénom *" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} required />
            <Champ label="Nom *" value={f.nom} onChange={(e) => maj("nom", e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Sexe</span>
              <select value={f.sexe} onChange={(e) => maj("sexe", e.target.value)} className={SELECT}>
                <option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option>
              </select>
            </label>
            <Champ label="Date de naissance" type="date" value={f.date_naissance} onChange={(e) => maj("date_naissance", e.target.value)} />
            <Champ label="Lieu de naissance" value={f.lieu_naissance} onChange={(e) => maj("lieu_naissance", e.target.value)} />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Classe {annee ? `(${annee.libelle})` : ""}</span>
            <select value={f.classe_id} onChange={(e) => maj("classe_id", e.target.value)} className={SELECT}>
              <option value="">— Pas d&apos;inscription pour l&apos;instant —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
            </select>
          </label>

          {doublons?.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">⚠️ {doublons.length > 1 ? "Des élèves portent" : "Un élève porte"} déjà ce nom :</p>
              <ul className="mt-2 space-y-1">
                {doublons.map((d) => {
                  const cl = (d.inscriptions || []).find((i) => i.annee_id === annee?.id)?.classes?.libelle;
                  return (
                    <li key={d.id}>
                      <Link to={`/eleves/${d.id}`} onClick={onFermer} className="font-medium underline">{d.prenom} {d.nom}</Link>
                      {" "}· {d.matricule}{d.date_naissance ? ` · né(e) le ${new Date(`${d.date_naissance}T00:00:00`).toLocaleDateString("fr-FR")}` : ""}{cl ? ` · ${cl}` : " · pas inscrit cette année"}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs">S&apos;il s&apos;agit du même enfant, ouvrez sa fiche pour l&apos;inscrire. Sinon, indiquez sa date de naissance ou continuez.</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
            <Bouton type="submit" disabled={enCours || !f.prenom.trim() || !f.nom.trim()}>
              {enCours ? "Vérification…" : doublons?.length > 0 ? "C'est un autre enfant, continuer →" : "Suivant →"}
            </Bouton>
          </div>
        </form>
      )}

      {etape === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-navy-900/70">Le responsable de <b>{nomEleve}</b> : il recevra le code d&apos;accès à l&apos;espace parent.</p>
          {!famille.aucun && (
            <>
              <Champ label="Téléphone" type="tel" value={famille.tel} placeholder="77 123 45 67"
                onChange={(e) => { majFam("tel", e.target.value); majFam("tuteurExistant", null); }} />
              {connus.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
                  <p className="font-medium text-sky-900">Ce numéro est déjà connu de l&apos;école (fratrie) :</p>
                  {connus.map((t) => {
                    const enfants = (t.eleve_tuteurs || []).map((x) => x.eleves?.prenom).filter(Boolean).join(", ");
                    return (
                      <label key={t.id} className="flex cursor-pointer items-center gap-2">
                        <input type="radio" name="connu" checked={famille.tuteurExistant?.id === t.id}
                          onChange={() => majFam("tuteurExistant", t)} />
                        <span>Rattacher à <b>{t.prenom} {t.nom}</b>{enfants ? `, déjà parent de ${enfants}` : ""}</span>
                      </label>
                    );
                  })}
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="connu" checked={!famille.tuteurExistant} onChange={() => majFam("tuteurExistant", null)} />
                    <span>C&apos;est un autre parent</span>
                  </label>
                </div>
              )}
              {!famille.tuteurExistant && (
                <div className="grid grid-cols-2 gap-4">
                  <Champ label="Prénom du parent *" value={famille.prenom} onChange={(e) => majFam("prenom", e.target.value)} />
                  <Champ label="Nom du parent *" value={famille.nom} onChange={(e) => majFam("nom", e.target.value)} />
                </div>
              )}
              <Champ label="Lien" value={famille.lien} onChange={(e) => majFam("lien", e.target.value)} placeholder="Père, Mère, Tuteur…" />
            </>
          )}
          <label className="flex items-center gap-2 text-sm text-navy-900/70">
            <input type="checkbox" checked={famille.aucun} onChange={(e) => majFam("aucun", e.target.checked)} />
            Pas de responsable pour l&apos;instant (à ajouter plus tard depuis la fiche)
          </label>
          <div className="flex justify-between gap-2">
            <Bouton type="button" variante="fantome" onClick={() => setEtape(0)} disabled={!!cree.eleve}>← Retour</Bouton>
            <Bouton onClick={creer} disabled={enCours || !peutCreer}>
              {enCours ? "Enregistrement…" : cree.eleve ? "Réessayer" : `Inscrire ${f.prenom || `l'${M}`}`}
            </Bouton>
          </div>
        </div>
      )}

      {etape === 2 && cree.eleve && (
        <EtapeFrais ecoleId={ecoleId} annee={annee} classe={classe} eleve={cree.eleve} devise={devise}
          onSuite={() => setEtape(3)} onErreur={setErreur} />
      )}

      {etape === 3 && cree.eleve && (
        <EtapeCode ecole={ecole} eleve={cree.eleve} tuteur={cree.tuteur} voitCodes={voitCodes}
          onFermer={onFermer} onAutre={() => { setEtape(0); setF(vide); setDoublons(null); setCree({ eleve: null, inscrit: false, tuteur: null });
            setFamille({ tel: "", prenom: "", nom: "", lien: "Parent", tuteurExistant: null, aucun: false }); }} />
      )}
    </Modale>
  );
}

// --- Étape 3 : les frais de la classe, puis un premier paiement facultatif ---
function EtapeFrais({ ecoleId, annee, classe, eleve, devise, onSuite, onErreur }) {
  const { utilisateur } = useAuth();
  const [frais, setFrais] = useState(null);
  const [choisis, setChoisis] = useState({});
  const [facture, setFacture] = useState(null);       // la facture créée, pour le premier paiement
  const [paie, setPaie] = useState({ montant: "", mode: "especes", reference: "", compte_id: "" });
  const [enCours, setEnCours] = useState(false);
  const [info, setInfo] = useState("");

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const [fr, niv, cs] = await Promise.all([pay.getFrais(ecoleId, annee?.id), getNiveaux(ecoleId), getComptes(ecoleId).catch(() => [])]);
        const cycleId = niv.find((n) => n.id === classe?.niveau_id)?.cycle_id || null;
        const appl = fraisApplicables(fr, classe?.niveau_id, cycleId);
        if (!vivant) return;
        setFrais(appl); setChoisis(fraisParDefaut(appl));
        const actifs = cs.filter((c) => c.actif !== false);
        setPaie((p) => ({ ...p, compte_id: actifs[0]?.id || "" }));
      } catch (e) { if (vivant) { setFrais([]); onErreur(e.message); } }
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecoleId, annee?.id, classe?.id]);

  const liste = (frais || []).filter((fr) => choisis[fr.id]);
  const total = liste.reduce((s, fr) => s + Number(fr.montant || 0), 0);

  async function facturer() {
    setEnCours(true); onErreur("");
    try {
      //  Même chemin que « Générer en lot » : tarif propre, exonération,
      //  inscription/réinscription (mig. 210-211), mois en cours pour les mensualités.
      const r = await pay.genererFacturesEnLot(ecoleId, annee?.id, [eleve.id], liste, null, new Date().toISOString().slice(0, 7));
      const dues = facturesAEncaisser(await pay.facturesOuvertesEleve(ecoleId, eleve.id));
      if (r.crees === 0 || !dues[0]) { setInfo("Rien à facturer pour cet élève (exonéré, ou montants nuls)."); return; }
      setFacture(dues[0]);
      setPaie((p) => ({ ...p, montant: String(resteFacture(dues[0])) }));
    } catch (e) { onErreur(e.message); }
    finally { setEnCours(false); }
  }

  async function encaisser() {
    const m = Number(paie.montant);
    if (!(m > 0) || m > resteFacture(facture)) { onErreur("Montant invalide : entre 1 et le reste dû."); return; }
    setEnCours(true); onErreur("");
    try { await pay.encaisser(ecoleId, facture.id, paie, utilisateur?.id); onSuite(); }
    catch (e) { onErreur(e.message); }
    finally { setEnCours(false); }
  }

  if (frais === null) return <p className="text-sm text-navy-900/60">Chargement de la grille tarifaire…</p>;

  if (facture) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ Facture <b>{facture.numero}</b> émise : {fmt(facture.montant_total)} {devise}.
        </p>
        <p className="text-sm font-medium text-navy-900/70">Premier paiement (facultatif)</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-36"><Champ label={`Montant (${devise})`} inputMode="numeric" value={paie.montant}
            onChange={(e) => setPaie((p) => ({ ...p, montant: e.target.value.replace(/[^0-9]/g, "") }))} /></div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Mode</span>
            <select value={paie.mode} onChange={(e) => setPaie((p) => ({ ...p, mode: e.target.value }))}
              className="rounded-lg border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500">
              {pay.MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {paie.mode !== "especes" && (
            <div className="w-36"><Champ label="Référence" value={paie.reference} onChange={(e) => setPaie((p) => ({ ...p, reference: e.target.value }))} /></div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Bouton variante="fantome" onClick={onSuite}>Plus tard</Bouton>
          <Bouton variante="or" onClick={encaisser} disabled={enCours || !paie.montant}>
            {enCours ? "Encaissement…" : `Encaisser ${fmt(paie.montant)} ${devise}`}
          </Bouton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-navy-900/70">Les frais de <b>{classe?.libelle}</b> d&apos;après la grille tarifaire. Les obligatoires sont cochés.</p>
      {info && <p className="rounded-xl bg-creme px-4 py-3 text-sm text-navy-900/70">{info}</p>}
      {frais.length === 0 ? (
        <p className="text-sm text-navy-900/60">Aucun frais dans la grille pour cette classe (Paiements → Grille tarifaire).</p>
      ) : (
        <div className="space-y-1.5">
          {frais.map((fr) => (
            <label key={fr.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-navy-900/15 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={!!choisis[fr.id]} onChange={(e) => setChoisis((c) => ({ ...c, [fr.id]: e.target.checked }))} />
                {fr.libelle}{fr.recurrent && <span className="text-xs text-navy-900/55">(mois en cours)</span>}
              </span>
              <span className="font-mono text-navy-900/70">{fmt(fr.montant)} {devise}</span>
            </label>
          ))}
          <p className="pt-1 text-right text-sm font-semibold text-navy-900">Total {fmt(total)} {devise}</p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Bouton variante="fantome" onClick={onSuite}>Passer</Bouton>
        <Bouton onClick={facturer} disabled={enCours || liste.length === 0}>{enCours ? "Facturation…" : "Émettre la facture →"}</Bouton>
      </div>
    </div>
  );
}

// --- Étape 4 : le code d'accès du parent, à remettre ou imprimer ---
function EtapeCode({ ecole, eleve, tuteur, voitCodes, onFermer, onAutre }) {
  const [code, setCode] = useState(tuteur?.code_acces || null);
  const etat = tuteur?.profil_id ? "connecte" : null; // parent qui a déjà son espace
  const [erreur, setErreur] = useState("");
  const origine = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";

  useEffect(() => {
    if (!tuteur || tuteur.profil_id || tuteur.code_acces || !voitCodes) return;
    //  Un code déjà remis à ce parent (fratrie) n'est PAS régénéré : celui
    //  qu'il a en main resterait sinon sans effet.
    genererCodeTuteur(tuteur.id).then(setCode).catch((e) => setErreur(e.message));
  }, [tuteur, voitCodes]);

  const message = code ? messageCodeParent(origine, ecole?.nom, eleve.prenom, code) : "";
  const wa = code ? lienWhatsApp(tuteur?.telephone, message) : null;

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        ✓ <b>{eleve.prenom} {eleve.nom}</b> est inscrit{eleve.sexe === "F" ? "e" : ""} · matricule <span className="font-mono">{eleve.matricule}</span>
      </p>
      <Alerte ton="erreur">{erreur}</Alerte>

      {!tuteur ? (
        <p className="text-sm text-navy-900/60">Pas de responsable : le code parent se donnera depuis la fiche, une fois le parent ajouté.</p>
      ) : etat === "connecte" ? (
        <p className="text-sm text-navy-900/70"><b>{tuteur.prenom} {tuteur.nom}</b> a déjà son espace parent : {eleve.prenom} y apparaît dès maintenant.</p>
      ) : !voitCodes ? (
        <p className="text-sm text-navy-900/60">Le code d&apos;accès du parent se donne dans Codes parents (réservé à la gestion).</p>
      ) : !code ? (
        <p className="text-sm text-navy-900/60">Génération du code…</p>
      ) : (
        <div className="zone-impression rounded-xl border border-navy-900/15 p-5 text-center">
          <p className="text-sm text-navy-900/70">{ecole?.nom} · Espace parent</p>
          <p className="mt-1 text-sm">Pour <b>{tuteur.prenom} {tuteur.nom}</b>, parent de <b>{eleve.prenom}</b></p>
          <p className="my-3 font-mono text-3xl font-bold tracking-widest text-navy-900">{code}</p>
          <p className="text-xs text-navy-900/70">1. Ouvrez {origine} · 2. « Je suis un parent » · 3. Entrez ce code</p>
        </div>
      )}

      <div className="no-print flex flex-wrap justify-end gap-2">
        {code && <Bouton variante="fantome" onClick={() => window.print()}>🖨️ Imprimer</Bouton>}
        {code && <Bouton variante="fantome" onClick={() => navigator.clipboard?.writeText(message)}>Copier le message</Bouton>}
        {wa && <a href={wa} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">WhatsApp</a>}
        <Link to={`/eleves/${eleve.id}`} onClick={onFermer} className="rounded-xl border border-navy-900/15 px-4 py-2.5 text-sm font-medium text-navy-900 hover:border-navy-900/40">Ouvrir la fiche</Link>
        <Bouton variante="fantome" onClick={onAutre}>Inscrire un autre</Bouton>
        <Bouton onClick={onFermer}>Terminer</Bouton>
      </div>
    </div>
  );
}
