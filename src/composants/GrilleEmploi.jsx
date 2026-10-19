// GesSchool — l'emploi du temps affiché comme celui que l'école imprime :
// les heures en lignes, les jours en colonnes, un cours de deux heures sur
// deux lignes, les pauses en bandeau gris sur toute la semaine.
//
// ⚠️ L'AFFICHAGE EST SÉPARÉ DE LA SAISIE. Ce composant ne sait rien de la
// base : on lui passe des créneaux déjà mis en forme ({ jour, heure_debut,
// heure_fin, titre, sous, detail, pause }). La gestion (EmploiDuTemps.jsx),
// l'impression et l'espace parent l'utilisent tels quels ; ajouter ou
// supprimer un créneau reste dans le mode « Modifier » de la gestion.
//
// Les lignes ne sont pas une grille fixe de 30 minutes : ce sont les heures
// de début et de fin réellement présentes (08h00, 08h30, 09h30…). Une école
// en séances d'une heure n'a donc pas deux fois plus de lignes que de cours.
//
// Pauses : un créneau sans matière (« Pause goûter – Récréation ») est un
// moment sans cours ; s'il a le même libellé tous les jours, il devient un
// seul bandeau. Un intervalle où AUCUN jour n'a de cours est aussi grisé :
// sans libellé saisi, on ne sait pas si c'est la récréation ou le repas.
//
// Couleurs : celles de l'école (charteEcole.js) — l'en-tête dans sa couleur
// primaire, les matières en teintes claires qui partent de sa couleur
// secondaire. Le logo et le nom de l'école coiffent la grille (`entete`).
import { JOURS } from "@/lib/emploi.js";
import { charteEmploi } from "@/lib/charteEcole.js";

const enMinutes = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
const affiche = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}h${String(min % 60).padStart(2, "0")}`;

// Une teinte par matière. La première teinte (celle de l'école) va à la
// matière la plus présente dans la semaine, et ainsi de suite : l'emploi du
// temps « porte » la couleur de l'école là où il y a le plus de cours. Deux
// classes peuvent donc avoir des couleurs différentes, mais une grille n'a
// jamais deux matières de la même couleur. La légende reste alphabétique.
//
// `ecole` : la fiche école (couleurs). `entete` : { logo, nom, titre, sous },
// le bandeau au-dessus de la grille ; absent, la grille est nue.
export default function GrilleEmploi({ creneaux, ecole, entete, vide = "Aucun cours planifié.", legende = true }) {
  const bandeau = entete && <EnTeteEmploi {...entete} couleur={charteEmploi(ecole, 1)} />;
  if (!creneaux.length) return <>{bandeau}<p className="py-6 text-center text-sm text-navy-900/40">{vide}</p></>;

  const jours = JOURS.filter(([j]) => j <= 5 || creneaux.some((c) => c.jour === j));
  const colonne = Object.fromEntries(jours.map(([j], i) => [j, i + 2]));

  const bornes = [...new Set(creneaux.flatMap((c) => [enMinutes(c.heure_debut), enMinutes(c.heure_fin)]))].sort((a, b) => a - b);
  const ligne = (min) => bornes.indexOf(min) + 2; // ligne 1 = en-têtes
  const intervalles = bornes.slice(0, -1).map((d, i) => [d, bornes[i + 1]]);

  const cles = [...new Set(creneaux.filter((c) => !c.pause).map((c) => c.couleur || c.titre))].sort((a, b) => a.localeCompare(b, "fr"));
  const charte = charteEmploi(ecole, cles.length);
  const poids = {};
  for (const c of creneaux) if (!c.pause) poids[c.couleur || c.titre] = (poids[c.couleur || c.titre] || 0) + 1;
  const rang = [...cles].sort((a, b) => poids[b] - poids[a] || a.localeCompare(b, "fr"));
  const couleurDe = (k) => charte.matieres[rang.indexOf(k)];
  const teinte = (c) => couleurDe(c.couleur || c.titre);

  // Créneaux regroupés par case (jour + heures) : deux groupes G1 / G2 sur le
  // même horaire partagent une case, l'un sous l'autre.
  const cases = {};
  for (const c of creneaux) {
    const k = `${c.jour}|${enMinutes(c.heure_debut)}|${enMinutes(c.heure_fin)}`;
    (cases[k] ||= []).push(c);
  }

  // Pauses identiques tous les jours → un seul bandeau.
  const bandeaux = [];
  const dejaEnBandeau = new Set();
  const pauses = creneaux.filter((c) => c.pause);
  for (const p of pauses) {
    const d = enMinutes(p.heure_debut), f = enMinutes(p.heure_fin);
    const cle = `${d}|${f}|${p.titre}`;
    if (bandeaux.some((b) => b.cle === cle)) continue;
    const memes = pauses.filter((x) => enMinutes(x.heure_debut) === d && enMinutes(x.heure_fin) === f && x.titre === p.titre);
    if (jours.every(([j]) => memes.some((x) => x.jour === j))) {
      bandeaux.push({ cle, d, f, titre: p.titre });
      memes.forEach((x) => dejaEnBandeau.add(x));
    }
  }
  // Intervalles sans aucun cours ni pause saisie, entre le premier et le dernier cours.
  const occupe = (d, f) => creneaux.some((c) => enMinutes(c.heure_debut) < f && enMinutes(c.heure_fin) > d);
  for (const [d, f] of intervalles) if (!occupe(d, f)) bandeaux.push({ cle: `trou|${d}`, d, f, titre: "Pause" });

  return (
    <div className="grille-edt">
      {bandeau}
      <div className="overflow-x-auto">
      <div className="grid min-w-[44rem] gap-px border border-navy-900/15 bg-navy-900/15 text-xs"
        style={{ gridTemplateColumns: `6.5rem repeat(${jours.length}, minmax(7.5rem, 1fr))`, gridAutoRows: "minmax(2.6rem, auto)" }}>
        <div className="px-2 py-2 font-semibold" style={{ ...charte.entete, gridRow: 1, gridColumn: 1 }}>Horaire</div>
        {jours.map(([j, l]) => (
          <div key={j} className="px-2 py-2 text-center font-semibold" style={{ ...charte.entete, gridRow: 1, gridColumn: colonne[j] }}>{l}</div>
        ))}

        {intervalles.map(([d, f]) => (
          <div key={`h${d}`} className="flex items-center px-2 font-mono text-[11px] font-semibold text-navy-900/70"
            style={{ background: charte.heures, gridRow: ligne(d), gridColumn: 1 }}>
            {affiche(d)} – {affiche(f)}
          </div>
        ))}

        {/* Fond blanc de chaque case : les cours viennent par-dessus. */}
        {intervalles.flatMap(([d]) => jours.map(([j]) => (
          <div key={`f${d}-${j}`} className="bg-white" style={{ gridRow: ligne(d), gridColumn: colonne[j] }} />
        )))}

        {bandeaux.map((b) => (
          <div key={b.cle} className="flex items-center justify-center px-2 text-center italic text-navy-900/70"
            style={{ background: charte.pause, gridRow: `${ligne(b.d)} / ${ligne(b.f)}`, gridColumn: `2 / ${jours.length + 2}` }}>
            {b.titre}
          </div>
        ))}

        {Object.entries(cases).map(([k, liste]) => {
          // G1 avant G2, quel que soit l'ordre de saisie.
          const visibles = liste.filter((c) => !dejaEnBandeau.has(c)).sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
          if (!visibles.length) return null;
          const [jour, d, f] = k.split("|").map(Number);
          if (!colonne[jour]) return null;
          const pause = visibles.every((c) => c.pause);
          return (
            <div key={k}
              className={`flex flex-col items-center justify-center gap-1 px-2 py-1.5 text-center ${pause ? "italic text-navy-900/70" : ""}`}
              style={{ background: pause ? charte.pause : teinte(visibles[0]), gridRow: `${ligne(d)} / ${ligne(f)}`, gridColumn: colonne[jour] }}>
              {visibles.map((c, i) => (
                <div key={i} className="leading-tight">
                  <p className="font-medium text-navy-900">{c.titre}</p>
                  {(c.sous || c.detail) && (
                    <p className="text-[10px] text-navy-900/60">{[c.sous, c.detail].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      </div>

      {legende && cles.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-navy-900/70">
          {cles.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm border border-navy-900/15" style={{ background: couleurDe(k) }} />{k}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Bandeau au-dessus de la grille : logo et nom de l'école à gauche, la classe
// (ou l'enseignant) à droite, un filet dans la couleur secondaire.
function EnTeteEmploi({ logo, nom, titre, sous, couleur }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4 border-b-4 pb-3" style={{ borderColor: couleur.secondaire }}>
      <div className="flex min-w-0 items-center gap-3">
        {logo && <img src={logo} alt="" className="h-12 w-12 shrink-0 object-contain" />}
        <div className="min-w-0">
          {nom && <p className="truncate font-display text-lg font-bold" style={{ color: couleur.titre }}>{nom}</p>}
          {sous && <p className="text-xs text-navy-900/60">{sous}</p>}
        </div>
      </div>
      {titre && <p className="shrink-0 text-right font-display text-base font-semibold" style={{ color: couleur.titre }}>{titre}</p>}
    </div>
  );
}
