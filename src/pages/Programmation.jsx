import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, EtatVide, Badge, Modale, SkeletonListe } from "@/composants/ui.jsx";
import { getAnneeCourante, getNiveaux } from "@/lib/academique.js";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import { lireDocx } from "@/lib/docxTableaux.js";
import { lireEntete, analyserTableau, resumer, grouperParDomaine, MOIS, COURS_CONNUS } from "@/lib/programmationIEF.js";
import * as api from "@/lib/programmation.js";

// GesSchool — importer la planification mensuelle officielle (IEF).
//
// Point 15 de la visite. L'école dépose le document Word diffusé par l'IEF ;
// l'écran le lit, MONTRE ce qu'il a compris, et n'enregistre qu'après
// confirmation.
//
// ⚠️ L'APERÇU N'EST PAS UN CONFORT, C'EST LE GARDE-FOU. Le document de
// l'école s'appelle « CE1 juin » et contient du CM1 d'avril : se fier au nom
// du fichier aurait rangé le programme dans la mauvaise classe ET le mauvais
// mois, pour toute l'année. Le niveau et le mois sont donc TOUJOURS
// confirmés à la main, même quand l'en-tête les annonce.

const nomMois = (m) => (MOIS.find(([n]) => Number(n) === Number(m)) || [, ""])[1];

export default function Programmation() {
  const { ecoleId } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();
  const [annee, setAnnee] = useState(null);
  const [niveaux, setNiveaux] = useState([]);
  const [niveauId, setNiveauId] = useState("");
  const [liste, setListe] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [lecture, setLecture] = useState(null);   // ce que le document a donné
  const [detail, setDetail] = useState(null);     // programmation ouverte

  useEffect(() => {
    (async () => {
      try {
        const [an, nv] = await Promise.all([getAnneeCourante(ecoleId), getNiveaux(ecoleId)]);
        setAnnee(an);
        setNiveaux(nv);
      } catch (e) { setErreur(e.message); }
    })();
  }, [ecoleId]);

  const recharger = useCallback(async () => {
    if (!annee?.id) return;
    setChargement(true);
    try { setListe(await api.getProgrammations(ecoleId, { anneeId: annee.id })); }
    catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [ecoleId, annee?.id]);

  useEffect(() => { recharger(); }, [recharger]);

  // --- Lire le document ---------------------------------------------------
  const choisirFichier = async (fichier) => {
    if (!fichier) return;
    setErreur("");
    setLecture(null);
    try {
      const { entete, tableaux } = await lireDocx(await fichier.arrayBuffer());
      if (!tableaux.length) throw new Error("Ce document ne contient aucun tableau.");
      // Le document de l'école porte tout le mois dans UN tableau ; on lit
      // néanmoins tous les tableaux, au cas où un exemplaire les sépare.
      const lignes = [];
      const domaines = [];
      for (const t of tableaux) {
        const r = analyserTableau(t);
        for (const d of r.domaines) if (!domaines.includes(d)) domaines.push(d);
        for (const l of r.lignes) lignes.push({ ...l, ordre: lignes.length + 1 });
      }
      const en = lireEntete(entete);
      // Le cours lu ne sert qu'à PROPOSER le niveau ; c'est l'utilisateur
      // qui tranche. Un rapprochement par libellé, jamais par position.
      const propose = en.cours
        ? niveaux.find((n) => (n.libelle || "").toUpperCase().replace(/\s+/g, "") === en.cours)
        : null;
      setLecture({
        nomFichier: fichier.name, entete, en, domaines, lignes,
        resume: resumer(lignes),
        niveauId: propose?.id || niveauId || "",
        mois: en.mois ? String(en.mois) : "",
      });
      if (propose) setNiveauId(propose.id);
    } catch (e) {
      setErreur(e.message || "Document illisible.");
    }
  };

  const enregistrer = async () => {
    if (!lecture) return;
    const niveau = niveaux.find((n) => n.id === lecture.niveauId);
    if (!niveau) { toast.erreur("Choisissez le niveau concerné."); return; }
    if (!lecture.mois) { toast.erreur("Choisissez le mois concerné."); return; }
    const domaines = grouperParDomaine(lecture.lignes);
    const deja = liste.filter((p) => p.niveau_id === niveau.id && p.mois === Number(lecture.mois)
      && domaines.some((d) => d.domaine === p.domaine));
    if (deja.length && !await confirmer(
      `${niveau.libelle} — ${nomMois(lecture.mois)} : ${deja.length} programmation(s) déjà importée(s) seront REMPLACÉES. Continuer ?`)) return;
    try {
      const r = await api.importerProgrammation({
        niveauId: niveau.id, anneeId: annee.id, mois: Number(lecture.mois),
        source: lecture.nomFichier, domaines,
      });
      toast.succes(`${r.lignes} contenus importés dans ${r.programmations} domaine(s).`);
      setLecture(null);
      await recharger();
    } catch (e) { toast.erreur(e.message || "L'import a échoué."); }
  };

  const parNiveau = useMemo(() => {
    const m = new Map();
    for (const p of liste) {
      const k = p.niveau_id;
      if (!m.has(k)) m.set(k, { libelle: p.niveaux?.libelle || "—", mois: new Map() });
      const e = m.get(k);
      if (!e.mois.has(p.mois)) e.mois.set(p.mois, []);
      e.mois.get(p.mois).push(p);
    }
    return [...m.values()];
  }, [liste]);

  if (!annee) {
    return (
      <>
        <EnTete titre="Programmation officielle" />
        <div className="p-8"><Alerte ton="erreur">{erreur || "Aucune année scolaire courante."}</Alerte></div>
      </>
    );
  }

  return (
    <>
      <EnTete titre="Programmation officielle" sousTitre={`Année ${annee.libelle}`} />
      <div className="space-y-5 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <Carte className="p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-navy-900">Déposer la planification de l'IEF</h3>
          <p className="mt-1.5 text-sm text-navy-900/60">
            Le document Word diffusé par l'inspection, tel qu'il vous a été remis.
            Il est lu et vous est montré <b>avant</b> tout enregistrement.
          </p>
          <label className="mt-4 flex cursor-pointer flex-wrap items-center gap-3">
            <input type="file" accept=".docx" className="hidden"
              onChange={(e) => { choisirFichier(e.target.files?.[0]); e.target.value = ""; }} />
            <span className="rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-medium text-creme hover:bg-navy-900/90">
              Choisir un document .docx
            </span>
            {lecture && <span className="text-sm text-navy-900/50">{lecture.nomFichier}</span>}
          </label>
          <p className="mt-3 text-xs text-navy-900/40">
            La planification est enregistrée <b>par niveau</b> : celle de CM1 vaut pour CM1 A comme pour CM1 B.
          </p>
        </Carte>

        {lecture && (
          <Apercu
            lecture={lecture} niveaux={niveaux}
            onChange={(k, v) => setLecture((s) => ({ ...s, [k]: v }))}
            onAnnuler={() => setLecture(null)}
            onValider={enregistrer}
          />
        )}

        <div>
          <h3 className="mb-3 font-display text-lg font-semibold text-navy-900">Déjà importé</h3>
          {chargement ? <SkeletonListe lignes={3} /> : parNiveau.length === 0 ? (
            <EtatVide icone="📋" titre="Aucune programmation">
              Déposez le document de l'IEF pour que les enseignants puissent y puiser leurs séances.
            </EtatVide>
          ) : (
            <div className="space-y-3">
              {parNiveau.map((n) => (
                <Carte key={n.libelle} className="p-5">
                  <div className="font-display font-semibold text-navy-900">{n.libelle}</div>
                  <div className="mt-3 space-y-2.5">
                    {[...n.mois.entries()].sort((a, b) => a[0] - b[0]).map(([mois, progs]) => (
                      <div key={mois} className="flex flex-wrap items-center gap-2">
                        <span className="w-24 shrink-0 text-sm font-medium text-or-600">{nomMois(mois)}</span>
                        {progs.map((p) => (
                          <button key={p.id} onClick={() => setDetail(p)}
                            className="rounded-full bg-navy-900/5 px-3 py-1 text-xs font-medium text-navy-900/70 hover:bg-navy-900/10">
                            {p.domaine}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </Carte>
              ))}
            </div>
          )}
        </div>
      </div>

      <ModaleDetail
        programmation={detail} onFermer={() => setDetail(null)}
        onSupprimer={async (p) => {
          if (!await confirmer(`Supprimer « ${p.domaine} » de ${nomMois(p.mois)} ? Les séances du cahier de textes qui la citent sont conservées.`)) return;
          try { await api.supprimerProgrammation(p.id); setDetail(null); await recharger(); toast.succes("Programmation supprimée."); }
          catch (e) { toast.erreur(e.message); }
        }}
      />
    </>
  );
}

// =====================================================================
//  L'aperçu — ce que l'écran a compris, avant d'écrire quoi que ce soit
// =====================================================================
function Apercu({ lecture, niveaux, onChange, onAnnuler, onValider }) {
  const { en, resume, domaines, lignes } = lecture;
  const [ouvert, setOuvert] = useState(domaines[0] || null);
  const niveau = niveaux.find((n) => n.id === lecture.niveauId);
  const coursInconnu = en.cours && !niveaux.some(
    (n) => (n.libelle || "").toUpperCase().replace(/\s+/g, "") === en.cours);

  return (
    <Carte className="border-or-500/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-navy-900">Ce que nous avons lu</h3>
        <Badge ton={resume.total ? "success" : "danger"}>{resume.total} contenus</Badge>
      </div>

      {/* 🔴 Le document peut contredire le nom du fichier : on le dit. */}
      <div className="mt-3 rounded-xl bg-navy-900/[0.03] p-3.5 text-sm">
        <div className="text-navy-900/50">D'après l'en-tête du document :</div>
        <div className="mt-1 font-medium text-navy-900">
          {en.cours ? `Cours ${en.cours}` : "cours non précisé"}
          {" · "}
          {en.mois ? nomMois(en.mois) : "mois non précisé"}
        </div>
        {(!en.cours || !en.mois) && (
          <div className="mt-1.5 text-xs text-navy-900/50">
            Ce que nous n'avons pas su lire n'est pas deviné : renseignez-le ci-dessous.
          </div>
        )}
        {coursInconnu && (
          <div className="mt-1.5 text-xs text-rose-600">
            Aucun niveau de l'école ne s'appelle « {en.cours} » : choisissez-le vous-même.
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Niveau concerné *</span>
          <select value={lecture.niveauId} onChange={(e) => onChange("niveauId", e.target.value)}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">— Choisir —</option>
            {niveaux.map((n) => <option key={n.id} value={n.id}>{n.libelle}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Mois concerné *</span>
          <select value={lecture.mois} onChange={(e) => onChange("mois", e.target.value)}
            className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            <option value="">— Choisir —</option>
            {MOIS.map(([n, l]) => <option key={n} value={n}>{l}</option>)}
          </select>
        </label>
      </div>

      {resume.total === 0 ? (
        <Alerte ton="erreur">
          Aucun contenu n'a été reconnu dans ce document. Il n'a probablement pas la forme
          habituelle de la planification de l'IEF — rien ne sera enregistré.
        </Alerte>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {domaines.map((d) => (
              <button key={d} onClick={() => setOuvert(ouvert === d ? null : d)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${ouvert === d
                  ? "bg-navy-900 text-creme" : "bg-navy-900/5 text-navy-900/70 hover:bg-navy-900/10"}`}>
                {d} <span className="opacity-60">{resume.parDomaine[d] || 0}</span>
              </button>
            ))}
          </div>

          <div className="mt-2 text-xs text-navy-900/45">
            {[1, 2, 3, 4, 5, 6].filter((s) => resume.parSemaine[s]).map((s) => `S${s} : ${resume.parSemaine[s]}`).join(" · ")}
            {resume.toutLeMois > 0 && ` · tout le mois : ${resume.toutLeMois}`}
          </div>

          {ouvert && (
            <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-navy-900/10">
              <ListeLignes lignes={lignes.filter((l) => l.domaine === ouvert)} />
            </div>
          )}
        </>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Bouton variante="fantome" onClick={onAnnuler}>Annuler</Bouton>
        <Bouton onClick={onValider} disabled={!lecture.niveauId || !lecture.mois || resume.total === 0}>
          Enregistrer {niveau ? `pour ${niveau.libelle}` : ""}
        </Bouton>
      </div>
    </Carte>
  );
}

//  Les lignes, regroupées comme le document les présente : sous-domaine,
//  rubrique, activité. C'est ainsi que l'enseignante les reconnaîtra.
function ListeLignes({ lignes }) {
  const groupes = [];
  for (const l of lignes) {
    const cle = `${l.sous_domaine || ""}|${l.rubrique || ""}|${l.activite || ""}`;
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.cle === cle) dernier.lignes.push(l);
    else groupes.push({ cle, tete: l, lignes: [l] });
  }
  return (
    <div className="divide-y divide-navy-900/5">
      {groupes.map((g, i) => (
        <div key={i} className="p-3">
          <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
            {g.tete.sous_domaine && <span className="font-semibold text-navy-900/70">{g.tete.sous_domaine}</span>}
            {g.tete.rubrique && <span className="text-navy-900/50">/ {g.tete.rubrique}</span>}
            {g.tete.activite && <span className="font-medium text-or-600">{g.tete.activite}</span>}
          </div>
          {g.tete.palier && <div className="mt-1 text-[11px] italic text-navy-900/40">{g.tete.palier}</div>}
          <ul className="mt-1.5 space-y-1">
            {g.lignes.map((l, k) => (
              <li key={k} className="flex gap-2 text-sm text-navy-900/80">
                <span className="mt-0.5 shrink-0 rounded bg-navy-900/5 px-1.5 text-[11px] font-medium text-navy-900/50">
                  {l.semaine ? `S${l.semaine}` : "mois"}
                </span>
                <span className="whitespace-pre-wrap">{l.contenu}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ModaleDetail({ programmation, onFermer, onSupprimer }) {
  const [lignes, setLignes] = useState(null);
  useEffect(() => {
    if (!programmation) { setLignes(null); return; }
    let vivant = true;
    api.getLignes(programmation.id).then((l) => { if (vivant) setLignes(l); }).catch(() => { if (vivant) setLignes([]); });
    return () => { vivant = false; };
  }, [programmation?.id]);

  return (
    <Modale ouvert={Boolean(programmation)} onFermer={onFermer} large
      titre={programmation ? `${programmation.domaine} — ${nomMois(programmation.mois)}` : ""}>
      {programmation && (
        <>
          <div className="text-xs text-navy-900/45">
            {programmation.niveaux?.libelle}
            {programmation.source && ` · source : ${programmation.source}`}
          </div>
          {lignes === null ? <SkeletonListe lignes={4} />
            : lignes.length === 0 ? <EtatVide icone="📋" titre="Aucune ligne" />
              : <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-xl border border-navy-900/10">
                  <ListeLignes lignes={lignes} />
                </div>}
          <div className="mt-4 flex justify-end">
            <Bouton variante="danger" onClick={() => onSupprimer(programmation)}>Supprimer</Bouton>
          </div>
        </>
      )}
    </Modale>
  );
}

// Référence conservée : la liste fermée des cours que l'en-tête sait nommer.
// Elle vit dans le module d'analyse, pas ici — mais l'écran doit pouvoir
// expliquer pourquoi un cours n'a pas été reconnu.
export const COURS_RECONNUS = COURS_CONNUS;
