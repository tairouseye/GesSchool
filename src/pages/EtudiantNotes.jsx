import { useEffect, useState } from "react";
import { Bouton, Carte, Alerte, EtatVide, Badge, SkeletonListe, Modale } from "@/composants/ui.jsx";
import ReleveImprimable from "@/composants/ReleveImprimable.jsx";
import { mesNotes, mesReleves, grouperNotes, monDossier } from "@/lib/etudiant.js";
import { noteFinale, moyenneUE, resultatUE, moyenneSemestre, mentionLMD } from "@/lib/lmd.js";

const n2 = (v) => (v === null || v === undefined || v === "" ? "—" : Number(v).toFixed(2));
const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—");

// Espace étudiant — résultats.
//
// Deux régimes volontairement distincts (migration 129) :
//  • Notes : visibles dès la saisie. L'étudiant est le sujet de la donnée.
//  • Relevés : uniquement ceux validés par le jury. Le reste est un document
//    de travail, et les moyennes affichées ici ne sont qu'indicatives.
export default function EtudiantNotes() {
  const [onglet, setOnglet] = useState("notes");
  const [notes, setNotes] = useState(null);
  const [releves, setReleves] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [aImprimer, setAImprimer] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    mesNotes().then((l) => setNotes(grouperNotes(l))).catch((e) => { setErreur(e.message); setNotes([]); });
    mesReleves().then(setReleves).catch((e) => { setErreur(e.message); setReleves([]); });
    monDossier().then(setDossier).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-5 text-creme">
        <p className="font-display text-xl font-bold">✎ Mes résultats</p>
        <p className="text-sm text-creme/70">Notes du semestre et relevés officiels</p>
      </div>

      <Alerte ton="erreur">{erreur}</Alerte>

      <div className="flex flex-wrap gap-2">
        {[["notes", "Mes notes"], ["releves", "Mes relevés"]].map(([v, l]) => (
          <button key={v} onClick={() => setOnglet(v)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${onglet === v ? "bg-navy-900 text-creme" : "border border-navy-900/15 text-navy-900/70"}`}>
            {l}
          </button>
        ))}
      </div>

      {onglet === "notes" ? <Notes semestres={notes} /> : <Releves liste={releves} onImprimer={setAImprimer} />}

      {/* Le relevé officiel : même composant que celui du secrétariat. */}
      <Modale ouvert={!!aImprimer} onFermer={() => setAImprimer(null)} titre="Relevé de notes" large>
        {aImprimer && (
          <>
            <ReleveImprimable
              ecole={{ nom: dossier?.ecole, sigle: dossier?.sigle, logo_url: dossier?.logo_url,
                adresse: dossier?.adresse, ville: dossier?.ville, pays: dossier?.pays }}
              etudiant={{ nom: `${dossier?.prenom || ""} ${dossier?.nom || ""}`.trim(),
                matricule: dossier?.matricule }}
              contexte={{ filiere: aImprimer.filiere, niveau: aImprimer.niveau,
                semestre: aImprimer.semestre, session: aImprimer.session,
                annee: aImprimer.annee, dateDelib: aImprimer.date_delib }}
              releve={aImprimer} />
            <div className="no-print mt-4 flex justify-end gap-2">
              <Bouton variante="fantome" onClick={() => setAImprimer(null)}>Fermer</Bouton>
              <Bouton onClick={() => window.print()}>Imprimer / PDF</Bouton>
            </div>
          </>
        )}
      </Modale>
    </div>
  );
}

function Notes({ semestres }) {
  if (semestres === null) return <SkeletonListe lignes={4} />;
  if (semestres.length === 0) {
    return (
      <EtatVide icone="✎" titre="Aucune note pour le moment">
        Vos notes apparaîtront ici au fur et à mesure de leur saisie par vos enseignants.
      </EtatVide>
    );
  }

  return (
    <div className="space-y-4">
      <Alerte ton="info">
        Ces moyennes sont <b>indicatives</b> : seul le relevé validé par le jury fait foi.
      </Alerte>

      {semestres.map((s) => {
        // On reconstitue la forme attendue par les calculs LMD partagés.
        const resultats = s.ues.map((u) => {
          const ecues = u.lignes.filter((l) => l.ecueId).map((l) => ({
            id: l.ecueId, credits: l.credits, coefficient: l.coefficient,
          }));
          // Sans ECUE, `moyenneUE` attend la clé littérale "ue" (pas l'id).
          const notes = {};
          for (const l of u.lignes) notes[l.ecueId || "ue"] = { cc: l.cc, examen: l.examen };
          return { ue: u, ...resultatUE({ id: u.id, credits: u.credits, coefficient: u.coefficient }, ecues, notes) };
        });
        const moy = moyenneSemestre(resultats);
        const acquis = resultats.reduce((t, r) => t + (r.acquise ? Number(r.ue.credits) || 0 : 0), 0);

        return (
          <Carte key={s.id} className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-semibold text-navy-900">{s.libelle}</h3>
                <p className="text-xs text-navy-900/55">
                  {[s.filiere, s.niveau, s.annee].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-bold text-navy-900">{n2(moy)}<span className="text-sm font-normal text-navy-900/40">/20</span></p>
                <p className="text-xs text-navy-900/50">
                  {acquis}/{s.creditsRequis} crédits{mentionLMD(moy) ? ` · ${mentionLMD(moy)}` : ""}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {resultats.map(({ ue, moyenne, acquise }) => (
                <div key={ue.id} className="rounded-xl border border-navy-900/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-navy-900">
                      {ue.code ? <span className="mr-2 font-mono text-xs text-navy-900/45">{ue.code}</span> : null}
                      {ue.intitule}
                    </p>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-navy-900">{n2(moyenne)}</span>
                      <Badge ton={acquise ? "success" : moyenne === null ? "neutre" : "danger"}>
                        {moyenne === null ? "en attente" : acquise ? `${ue.credits} crédits` : "non acquise"}
                      </Badge>
                    </span>
                  </div>

                  {ue.lignes.filter((l) => l.ecueId).length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-navy-900/5 pt-2">
                      {ue.lignes.filter((l) => l.ecueId).map((l) => (
                        <li key={l.ecueId + l.session} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-navy-900/70">
                            {l.intitule}
                            {l.session === "rattrapage" && <Badge ton="warning" className="ml-2">rattrapage</Badge>}
                          </span>
                          <span className="shrink-0 tabular-nums text-navy-900/60">
                            CC {n2(l.cc)} · Examen {n2(l.examen)} · <b className="text-navy-900">{n2(noteFinale({ cc: l.cc, examen: l.examen }))}</b>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Carte>
        );
      })}
    </div>
  );
}

function Releves({ liste, onImprimer }) {
  if (liste === null) return <SkeletonListe lignes={3} />;
  if (liste.length === 0) {
    return (
      <EtatVide icone="📜" titre="Aucun relevé publié">
        Votre relevé sera disponible ici une fois la délibération du jury validée.
      </EtatVide>
    );
  }

  return (
    <div className="space-y-3">
      {liste.map((r) => (
        <Carte key={r.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-semibold text-navy-900">{r.semestre}</h3>
              <p className="text-xs text-navy-900/55">
                {[r.filiere, r.niveau, r.annee].filter(Boolean).join(" · ")}
                {r.session === "rattrapage" ? " · session de rattrapage" : ""}
                {" · "}délibéré le {dateFr(r.date_delib)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold text-navy-900">{n2(r.moyenne)}<span className="text-sm font-normal text-navy-900/40">/20</span></p>
              <p className="text-xs text-navy-900/50">{r.credits_acquis}/{r.credits_total} crédits</p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Bouton variante="fantome" onClick={() => onImprimer(r)}>📄 Relevé officiel</Bouton>
            {r.decision && (
              <Badge ton={/admis/i.test(r.decision) ? "success" : "danger"}>{r.decision}</Badge>
            )}
            {r.mention && <Badge ton="or">{r.mention}</Badge>}
          </div>

          {Array.isArray(r.details) && r.details.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-navy-900/5 pt-2">
              {r.details.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-navy-900/70">
                    {d.code ? <span className="mr-2 font-mono text-navy-900/45">{d.code}</span> : null}
                    {d.intitule}
                  </span>
                  <span className="shrink-0 tabular-nums text-navy-900/60">
                    {n2(d.moyenne)} · {d.acquise ? `${d.credits} crédits` : "non acquise"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      ))}
    </div>
  );
}
