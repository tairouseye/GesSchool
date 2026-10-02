import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, EtatVide, SkeletonListe, Badge } from "@/composants/ui.jsx";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import Photo from "@/composants/Photo.jsx";
import { getAnneeCourante, getClasses } from "@/lib/academique.js";
import { getMesClasses, getMonEnseignant } from "@/lib/appel.js";
import { voitToutesClasses } from "@/lib/permissions.js";
import * as api from "@/lib/eleves.js";

// GesSchool — prendre les photos des élèves, classe par classe.
//
// ⚠️ POURQUOI CET ÉCRAN EXISTE. Le téléversement était en place depuis la
// migration 003 et fonctionnait depuis la fiche élève… et pourtant AUCUNE
// photo n'avait jamais été enregistrée : 0 sur 172 élèves. Ouvrir 96 fiches
// une par une n'est pas une tâche qu'on fait. Ce n'est pas la plomberie qui
// manquait, c'est un écran où l'on enchaîne.
//
// ⚠️ CONÇU POUR LE TÉLÉPHONE, DEBOUT, EN CLASSE. `capture="environment"`
// ouvre directement l'appareil photo au lieu d'un explorateur de fichiers,
// la grille tient en deux colonnes, et les cibles tactiles sont larges. Le
// compteur dit où l'on en est : sans lui, on ne sait pas qui reste.

export default function Photos() {
  const { ecoleId, roles, profil, utilisateur } = useAuth();
  const toutVoir = voitToutesClasses(roles);
  const confirmer = useConfirm();
  const toast = useToast();
  const [annee, setAnnee] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState("");
  const [eleves, setEleves] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState("");   // eleve_id en téléversement
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const an = await getAnneeCourante(ecoleId);
        setAnnee(an);
        //  Même règle que partout : la direction voit toutes les classes,
        //  l'enseignant les siennes (cf. Feuille de présence, v2.230.0).
        const cls = toutVoir
          ? await getClasses(ecoleId, an?.id)
          : await getMesClasses(ecoleId, an?.id,
              (await getMonEnseignant(ecoleId, profil?.id, utilisateur?.email))?.id);
        setClasses(cls);
        if (cls.length) setClasseId(cls[0].id);
      } catch (e) { setErreur(e.message); }
      finally { setChargement(false); }
    })();
  }, [ecoleId, profil?.id, utilisateur?.email, toutVoir]);

  const recharger = useCallback(async () => {
    if (!classeId || !annee?.id) { setEleves([]); return; }
    setErreur("");
    try { setEleves(await api.getElevesPourPhotos(ecoleId, classeId, annee.id)); }
    catch (e) { setErreur(e.message); }
  }, [ecoleId, classeId, annee?.id]);

  useEffect(() => { recharger(); }, [recharger]);

  async function envoyer(eleve, file) {
    if (!file) return;
    //  Un garde-fou simple : une photo de 8 Mo prise au téléphone coûte de
    //  la bande passante aux familles comme à l'école, pour un portrait
    //  affiché en 40 pixels.
    if (file.size > 5 * 1024 * 1024) {
      toast.erreur("Photo trop lourde (5 Mo maximum). Réduisez la qualité de l'appareil.");
      return;
    }
    setEnCours(eleve.id);
    try {
      const chemin = await api.televerserPhoto(ecoleId, eleve.id, file);
      await api.majEleve(eleve.id, { photo_url: chemin });
      //  On met à jour la ligne sur place : recharger toute la classe après
      //  chaque photo rendrait la saisie de 96 élèves pénible.
      setEleves((l) => l.map((x) => (x.id === eleve.id ? { ...x, photo_url: chemin } : x)));
    } catch (e) { toast.erreur(e.message || "Envoi impossible."); }
    finally { setEnCours(""); }
  }

  const faites = useMemo(() => eleves.filter((e) => e.photo_url).length, [eleves]);
  const classe = classes.find((c) => c.id === classeId);

  if (chargement) {
    return (<><EnTete titre="Photos des élèves" /><div className="p-8"><SkeletonListe lignes={4} /></div></>);
  }

  return (
    <>
      <EnTete
        titre="Photos des élèves"
        sousTitre={annee ? `Année ${annee.libelle}` : ""}
        action={classes.length > 0 && (
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)}
            className="rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        )}
      />
      <div className="space-y-4 p-4 sm:p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        {classes.length === 0 ? (
          <Carte className="p-6 text-sm text-navy-900/60">
            {toutVoir
              ? <>Aucune classe pour cette année. Créez-les dans <b>Structure → Niveaux &amp; classes</b>.</>
              : <>Aucune classe ne vous est attribuée pour cette année.</>}
          </Carte>
        ) : (
          <>
            <Carte className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-semibold text-navy-900">{classe?.libelle}</span>
                {/* Le compteur : sans lui, on ne sait pas qui reste à photographier. */}
                <Badge ton={faites === eleves.length && eleves.length ? "success" : "neutre"}>
                  {faites} / {eleves.length} photo{eleves.length > 1 ? "s" : ""}
                </Badge>
              </div>
              <p className="text-xs text-navy-900/45">
                Touchez un élève pour prendre sa photo. Elle reste privée : seuls l&apos;école et
                le parent de l&apos;enfant y ont accès.
              </p>
            </Carte>

            {eleves.length === 0 ? (
              <EtatVide icone="📷" titre="Aucun élève inscrit">
                Aucun élève inscrit dans cette classe pour cette année.
              </EtatVide>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {eleves.map((e) => (
                  <VignetteEleve
                    key={e.id} eleve={e} occupe={enCours === e.id}
                    onFichier={(file) => envoyer(e, file)}
                    onRetirer={async () => {
                      if (!await confirmer(`Retirer la photo de ${e.prenom} ${e.nom} ?`)) return;
                      try {
                        await api.retirerPhoto(e.id, e.photo_url);
                        setEleves((l) => l.map((x) => (x.id === e.id ? { ...x, photo_url: null } : x)));
                      } catch (err) { toast.erreur(err.message); }
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function VignetteEleve({ eleve, occupe, onFichier, onRetirer }) {
  const initiales = `${(eleve.prenom?.[0] || "").toUpperCase()}${(eleve.nom?.[0] || "").toUpperCase()}`;
  return (
    <Carte className="overflow-hidden p-0">
      <label className={`block ${occupe ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
        {/*  ⚠️ `capture="environment"` ouvre l'appareil photo directement.
            Sans cet attribut, le téléphone propose un explorateur de
            fichiers — et la prise de vue en classe devient impraticable. */}
        <input type="file" accept="image/*" capture="environment" className="hidden"
          disabled={occupe}
          onChange={(ev) => { onFichier(ev.target.files?.[0]); ev.target.value = ""; }} />
        <div className="relative aspect-square w-full bg-navy-900/5">
          <Photo
            bucket="eleves" valeur={eleve.photo_url} alt=""
            className="h-full w-full object-cover"
            fallback={
              <span className="grid h-full w-full place-items-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-navy-900/10 font-display text-lg font-semibold text-navy-900/50">
                  {initiales || "?"}
                </span>
              </span>
            }
          />
          {occupe && (
            <span className="absolute inset-0 grid place-items-center bg-white/70 text-xs font-medium text-navy-900">
              Envoi…
            </span>
          )}
          {!eleve.photo_url && !occupe && (
            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-or-500 px-2 py-0.5 text-[11px] font-semibold text-navy-900">
              📷 Prendre
            </span>
          )}
        </div>
        <div className="p-2.5">
          <p className="truncate text-sm font-medium text-navy-900">{eleve.prenom} {eleve.nom}</p>
          <p className="truncate font-mono text-[11px] text-navy-900/40">{eleve.matricule || "—"}</p>
        </div>
      </label>
      {eleve.photo_url && (
        <div className="border-t border-navy-900/5 px-2.5 py-1.5">
          <button type="button" onClick={onRetirer}
            className="text-[11px] text-rose-500 hover:underline">retirer</button>
        </div>
      )}
    </Carte>
  );
}
