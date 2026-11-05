import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Alerte, Badge } from "@/composants/ui.jsx";
import {
  Salutation, Bloc, Chiffre, Evolution, GraphiqueAnnuel, Agenda, ListeCompacte, BarresListe, RaccourcisBloc,
} from "@/composants/TableauBord.jsx";
import { statsPedagogie, blocsPedagogie, donneesAppelsDuJour } from "@/lib/dashboard.js";
import { classesSansAppel } from "@/lib/maJournee.js";
import { getAbsencesRecentes, STATUTS_JUSTIF } from "@/lib/viescolaire.js";
import { getAnneeCourante, compterAdoption } from "@/lib/academique.js";
import { compterASigner } from "@/lib/documents.js";
import { compterDemandesEnAttente } from "@/lib/demandes.js";
import { peutVoir, estRoleComplet } from "@/lib/permissions.js";
import { moduleActif } from "@/lib/modules.js";
import { couvreScolaire, couvreSuperieur } from "@/lib/paliers.js";
import MaJournee from "@/composants/MaJournee.jsx";
import MiseEnRoute from "@/composants/MiseEnRoute.jsx";
import { lignesAdoption } from "@/lib/miseEnRoute.js";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "");
// Couleur d'une moyenne /20 : rouge sous la barre, ambre limite, vert au-dessus.
const tonMoyenne = (m) => (m == null ? "text-navy-900/30" : m < 10 ? "text-rose-700" : m < 12 ? "text-or-600" : "text-emerald-700");
const pl = (n, mot, motPl = `${mot}s`) => `${n} ${n > 1 ? motPl : mot}`;
const BADGE_JUSTIF = { rouge: "danger", or: "warning", vert: "success" };
const pct = (v) => (v == null ? "—" : `${v.toFixed(1).replace(".", ",")} %`);

// Accueil Pédagogie — version « Classter » validée le 31/10/2026
// (docs/maquette-tableaux-classter.html, onglet 2).
//  L'enseignant a son propre accueil, sur le modèle de l'espace parent : il n'a
//  pas à traverser les chiffres de l'école pour faire l'appel.
export default function AccueilPedagogie() {
  const { ecole, roles } = useAuth();
  const direction = estRoleComplet(roles) || (roles || []).includes("direction");
  return !direction && (roles || []).includes("enseignant") && couvreScolaire(ecole) ? <MaJournee /> : <AccueilDirection />;
}

function AccueilDirection() {
  const { ecoleId, ecole, profil, roles, modulesActifs } = useAuth();
  const [annee, setAnnee] = useState(null);
  const [stats, setStats] = useState(null);
  const [blocs, setBlocs] = useState(null);
  const [absences, setAbsences] = useState([]);
  const [aSigner, setASigner] = useState(0);
  const [demandes, setDemandes] = useState(0);
  const [adoption, setAdoption] = useState(null);
  const [sansAppel, setSansAppel] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        const [st, abs, sig, dem] = await Promise.all([
          statsPedagogie(ecoleId, an?.id),
          getAbsencesRecentes(ecoleId, 5),
          compterASigner().catch(() => 0),
          compterDemandesEnAttente(ecoleId).catch(() => 0),
        ]);
        setStats(st); setAbsences(abs); setASigner(sig); setDemandes(dem);
        compterAdoption(ecoleId).then(setAdoption).catch(() => {});
        donneesAppelsDuJour(ecoleId, an?.id).then((d) => d && setSansAppel(classesSansAppel(d))).catch(() => {});
        //  Les blocs détaillés après les chiffres : l'écran s'affiche sans les attendre.
        setBlocs(await blocsPedagogie(ecoleId, an, st.effectif));
      } catch (e) {
        setErreur(e.message);
      } finally {
        setChargement(false);
      }
    })();
  }, [ecoleId]);

  //  Même règle que Gestion : on ne propose que ce que ce rôle peut ouvrir.
  const ouvert = (cle) => peutVoir(roles, cle) && moduleActif(modulesActifs, cle);
  //  L'avancement de la saisie compare les enseignants entre eux : c'est
  //  un outil de direction, pas une vitrine entre collègues.
  const direction = estRoleComplet(roles) || (roles || []).includes("direction");
  const scolaire = couvreScolaire(ecole);
  const superieur = couvreSuperieur(ecole);

  const aTraiter = stats ? [
    blocs?.horsAnnee && ouvert("structure") && {
      to: "/parametres/structure", ton: "rouge", bouton: "Corriger",
      titre: `Dates des périodes hors de l'année ${annee?.libelle || ""}`.trim() },
    ouvert("appel") && sansAppel.length > 0 && {
      to: `/appel?classe=${sansAppel[0].id}`, ton: "rouge", bouton: "Voir",
      titre: `${pl(sansAppel.length, "classe")} sans appel : ${sansAppel.slice(0, 3).map((c) => c.libelle).join(", ")}${sansAppel.length > 3 ? "…" : ""}` },
    ouvert("assiduite") && stats.justifEnAttente > 0 && {
      to: "/assiduite", ton: "or", bouton: "Examiner", titre: `${pl(stats.justifEnAttente, "justificatif")} d'absence` },
    ouvert("assiduite") && stats.absNonJustif > 0 && {
      to: "/assiduite", ton: "rouge", bouton: "Relancer", titre: pl(stats.absNonJustif, "absence non justifiée", "absences non justifiées") },
    ouvert("bulletins") && stats.bulletinsBrouillon > 0 && {
      to: "/bulletins", ton: "bleu", bouton: "Relire", titre: `${pl(stats.bulletinsBrouillon, "bulletin")} en relecture` },
    ouvert("bulletins") && stats.bulletinsValides > 0 && {
      to: "/bulletins", ton: "violet", bouton: "Publier", titre: `${pl(stats.bulletinsValides, "bulletin")} à publier` },
    ouvert("demandes") && demandes > 0 && {
      to: "/demandes", ton: "navy", bouton: "Traiter", titre: `${pl(demandes, "demande")} de document` },
    ouvert("signatures") && aSigner > 0 && {
      to: "/a-signer", ton: "bleu", bouton: "Signer", titre: `${pl(aSigner, "document")} à signer` },
    //  L'enseignant n'a pas à voir combien de collègues sont connectés.
    ...(direction ? lignesAdoption(adoption, ouvert) : []),
  ].filter(Boolean) : [];

  const evolPresence = blocs?.presence != null && blocs?.presenceAvant != null
    ? Math.round((blocs.presence - blocs.presenceAvant) * 10) / 10 : null;
  const saisiePct = blocs?.saisieTotal ? Math.round((blocs.saisieFaites / blocs.saisieTotal) * 100) : null;

  return (
    <>
      <EnTete titre="Pédagogie" sousTitre={annee ? `${ecole?.nom} · Année ${annee.libelle}` : ecole?.nom}
        action={scolaire && ouvert("appel") && (
          <Link to="/appel" className="rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-creme hover:bg-navy-800">✓ Faire l'appel</Link>
        )} />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <Salutation prenom={profil?.prenom}>{blocs?.periodeEnCours ? `Période en cours : ${blocs.periodeEnCours.libelle}.` : null}</Salutation>

        {/*  Mise en route (prise en main, lot 2) : pour ceux qui paramètrent
             l'école — promoteur et direction —, tant qu'elle n'est pas finie. */}
        {direction && (
          <MiseEnRoute ecoleId={ecoleId} ecole={ecole} modulesActifs={modulesActifs} compacte />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Chiffre chargement={!blocs && chargement} label="Taux de présence (semaine)" icone="✓" ton="vert"
            valeur={blocs ? pct(blocs.presence) : null}
            ligne={blocs && (evolPresence != null
              ? <Evolution delta={evolPresence} format={(v) => `${String(v).replace(".", ",")} pt`} texte="sur la semaine dernière" />
              : <span className="text-navy-900/55">Estimé à partir des absences</span>)} />
          <Chiffre chargement={chargement} label="Absents aujourd'hui" icone="🚸" ton="rouge"
            valeur={stats?.absJour} tonValeur={stats?.absJour > 0 ? "text-rose-700" : "text-navy-900"}
            ligne={stats && <span className="text-navy-900/55">{pl(stats.absSemaine, "absence")} cette semaine</span>} />
          <Chiffre chargement={chargement} label="Moyenne générale" icone="✎" ton="bleu"
            valeur={stats?.moyenne != null ? stats.moyenne.toFixed(1).replace(".", ",") : "—"} suffixe="/20" tonValeur={tonMoyenne(stats?.moyenne)}
            ligne={stats && <span className="text-navy-900/55">{pl(stats.nbNotes, "note saisie", "notes saisies")}</span>} />
          <Chiffre chargement={!blocs && chargement} label={`Saisie des notes${blocs?.periode ? ` (${blocs.periode.libelle})` : ""}`} icone="▤" ton="or"
            valeur={blocs ? (saisiePct != null ? `${saisiePct} %` : "—") : null} barre={saisiePct}
            ligne={blocs && <span className="text-navy-900/55">{blocs.saisieFaites} matière·classe sur {blocs.saisieTotal} évaluées</span>} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Bloc titre="Absences — 8 dernières semaines" to={ouvert("assiduite") ? "/assiduite" : null} lien="Assiduité" className="lg:col-span-2">
            {blocs && <GraphiqueAnnuel points={blocs.assiduite.map((s) => ({ lib: s.lib, val: s.absences, ref: null }))}
              legende={["Absences par semaine"]} hauteur={180} />}
          </Bloc>
          <Bloc titre="Agenda pédagogique">
            <Agenda items={blocs?.agenda || []} vide="Aucune évaluation ni fin de période programmée." />
          </Bloc>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Bloc titre="À traiter" compteur={aTraiter.length}>
            <ListeCompacte items={aTraiter} />
          </Bloc>
          <Bloc titre="Moyennes par niveau">
            <BarresListe vide="Pas encore de notes cette année."
              items={(stats?.niveaux || []).filter((n) => n.moyenne != null).map((n) => ({
                label: n.libelle, pct: (n.moyenne / 20) * 100, droite: n.moyenne.toFixed(1).replace(".", ","),
                ton: n.moyenne < 10 ? "rouge" : n.moyenne < 12 ? "or" : "vert",
              }))} />
            {stats?.niveaux?.some((n) => n.moyenne == null) && (
              <p className="mt-3 text-xs text-navy-900/50">Les niveaux sans moyenne (préscolaire) sont suivis par les acquis.</p>
            )}
          </Bloc>
          {direction ? (
            <Bloc titre="Saisie des notes par enseignant" to={ouvert("notes") ? "/notes" : null} lien="Notes">
              {blocs && blocs.saisie.length === 0 ? (
                <p className="mt-3 text-sm text-navy-900/60">Aucune affectation enseignant pour cette année.</p>
              ) : (
                <ul className="mt-3 space-y-2.5 text-xs">
                  {(blocs?.saisie || []).slice(0, 6).map((e) => (
                    <li key={e.nom}>
                      <div className="flex justify-between gap-2">
                        <span className="truncate font-medium text-navy-900" title={e.classes}>{e.nom}{e.classes ? ` · ${e.classes}` : ""}</span>
                        <span className={`shrink-0 ${e.pct >= 100 ? "text-emerald-700" : e.pct < 40 ? "text-rose-700" : "text-navy-900"}`}>
                          {e.faites} / {e.total}{e.pct >= 100 ? " ✓" : ""}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-900/10">
                        <div className={`h-full rounded-full ${e.pct >= 100 ? "bg-emerald-500" : e.pct < 40 ? "bg-rose-500" : "bg-or-500"}`} style={{ width: `${e.pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Bloc>
          ) : (
            <Bloc titre="Raccourcis">
              <Raccourcis ouvert={ouvert} scolaire={scolaire} superieur={superieur} />
            </Bloc>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Bloc titre="Absences récentes" to={ouvert("assiduite") ? "/assiduite" : null} lien="Assiduité" className={direction ? "lg:col-span-2" : "lg:col-span-3"}>
            {absences.length === 0 ? (
              <p className="mt-3 text-sm text-navy-900/60">Aucune absence enregistrée.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-navy-900/50">
                    <tr><th className="py-2 font-medium">Élève</th><th className="font-medium">Classe</th><th className="font-medium">Date</th>
                      <th className="hidden font-medium sm:table-cell">Type</th><th className="text-right font-medium">Statut</th></tr>
                  </thead>
                  <tbody className="divide-y divide-navy-900/5">
                    {absences.map((a) => {
                      const s = STATUTS_JUSTIF[a.statut] || STATUTS_JUSTIF.non_justifie;
                      return (
                        <tr key={a.id}>
                          <td className="py-2 pr-2 font-medium text-navy-900">{a.eleves?.prenom} {a.eleves?.nom}</td>
                          <td className="pr-2 text-navy-900/70">{a.classes?.libelle || "—"}</td>
                          <td className="pr-2 text-navy-900/60">{fmtDate(a.date_abs)}</td>
                          <td className="hidden pr-2 capitalize text-navy-900/70 sm:table-cell">{a.type}</td>
                          <td className="text-right"><Badge ton={BADGE_JUSTIF[s.ton]}>{s.label}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Bloc>
          {direction && (
            <Bloc titre="Raccourcis">
              <Raccourcis ouvert={ouvert} scolaire={scolaire} superieur={superieur} />
            </Bloc>
          )}
        </div>
      </div>
    </>
  );
}

function Raccourcis({ ouvert, scolaire, superieur }) {
  return (
    <RaccourcisBloc items={[
      scolaire && ouvert("appel") && { to: "/appel", icone: "✅", label: "Faire l'appel" },
      superieur && ouvert("appel_sup") && { to: "/appel-sup", icone: "✅", label: "Présence par séance" },
      scolaire && ouvert("notes") && { to: "/notes", icone: "✎", label: "Saisir des notes" },
      superieur && ouvert("notes_lmd") && { to: "/notes-lmd", icone: "✎", label: "Notes (UE)" },
      scolaire && ouvert("cahier") && { to: "/cahier-textes", icone: "📓", label: "Cahier de textes" },
      scolaire && ouvert("emploi") && { to: "/emploi-du-temps", icone: "🗓️", label: "Emploi du temps" },
    ].filter(Boolean).slice(0, 4)} />
  );
}
