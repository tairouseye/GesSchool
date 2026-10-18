import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import { majEcole, majConfigMatricule, televerserAsset, getSignataires, setSignataires, getChampsEleve, setChampsEleve } from "@/lib/academique.js";
import { appliquerAccent, accentPeuVisible, COULEUR_DEFAUT } from "@/lib/theme.js";
import { PAYS, deviseDuPays } from "@/lib/pays.js";
import { MODULES, tousLesModules, moduleActif } from "@/lib/modules.js";
import { estRoleComplet, peutVoirSection } from "@/lib/permissions.js";
import { getMembres } from "@/lib/membres.js";
import { getNotationConfig, setNotationConfig, DEFAUT_NOTATION } from "@/lib/bulletins.js";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";
import * as relancesApi from "@/lib/relances.js";
import { pspEtat, setPspConfig, PRESTATAIRES } from "@/lib/paiementEnLigne.js";
import { PALIERS, COMBINAISONS, PEDAGOGIES, paliersDeclares, resume as resumePaliers,
         combinaisonDe, trou, pedagogiePertinente, couvreSuperieur,
         profilAEnregistrer } from "@/lib/paliers.js";
import { rubriquesVisibles, grouperRubriques } from "@/lib/parametresRubriques.js";
import { useFormulaire, useSignalModif, PiedEnregistrer, FournisseurModif } from "@/composants/Enregistrement.jsx";

const DEVISES = ["XOF", "XAF", "CDF", "USD", "EUR", "GNF", "MAD", "MRU"];

// =====================================================================
//  Une sous-page par rubrique (audit d'ergonomie P2, variante A retenue
//  par le promoteur sur maquette — docs/maquette-parametres.html).
//
//  Avant : neuf réglages empilés sur une seule page, chacun avec son
//  « Enregistrer », et un « Enregistré ✓ » affiché tout en haut, loin du
//  bouton. Désormais : ordinateur = menu à gauche + une rubrique ; téléphone
//  = la liste, puis la rubrique en plein écran avec « ‹ Paramètres ».
//
//  ⚠️ LA RUBRIQUE EST DANS L'ADRESSE (/parametres/notation), comme la fiche
//  enfant en 2.265 : le retour du téléphone revient à la liste, et une autre
//  page peut renvoyer droit vers « Relances automatiques ».
//
//  ⚠️ LIMITE CONNUE : le HashRouter ne sait pas bloquer une navigation. La
//  confirmation « quitter sans enregistrer » couvre le menu des rubriques,
//  « ‹ Paramètres » et la fermeture de l'onglet — pas le menu général de
//  l'application ni le bouton retour du navigateur.
// =====================================================================
export default function Parametres() {
  const { ecoleId, ecole, roles, modulesActifs, rafraichirProfil } = useAuth();
  const { rubrique } = useParams();
  const naviguer = useNavigate();
  const confirmer = useConfirm();
  const [erreur, setErreur] = useState("");
  const [modifie, setModifie] = useState(false);
  const contenuRef = useRef(null);

  const estComplet = estRoleComplet(roles);
  // Chaque responsable ne voit que les rubriques de son domaine ; le promoteur
  // les voit toutes (cf. SECTIONS_PARAMETRES dans permissions.js).
  const visibles = rubriquesVisibles({
    voit: (s) => peutVoirSection(roles, s),
    estComplet,
    moduleOk: (m) => moduleActif(modulesActifs, m),
  });
  const groupes = grouperRubriques(visibles);
  const demandee = visibles.find((r) => r.id === rubrique);
  // Sans rubrique dans l'adresse, l'ordinateur ouvre la première ; le téléphone
  // montre la liste (cf. classes `lg:` plus bas).
  const courante = demandee || visibles[0];

  // Rubrique inconnue, ou fermée à ce rôle : retour à la liste.
  useEffect(() => {
    if (rubrique && !demandee) naviguer("/parametres", { replace: true });
  }, [rubrique, demandee, naviguer]);

  // On repart du haut en changeant de rubrique (le défilement est celui de <main>).
  useEffect(() => {
    setErreur("");
    contenuRef.current?.closest("main")?.scrollTo({ top: 0 });
  }, [rubrique]);

  // Fermer l'onglet avec une saisie en attente : le navigateur prévient.
  useEffect(() => {
    if (!modifie) return;
    const avertir = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [modifie]);

  async function aller(vers, e) {
    e?.preventDefault();
    if (modifie && courante && vers !== `/parametres/${courante.id}`) {
      const ok = await confirmer({
        titre: "Modifications non enregistrées",
        message: `« ${courante.titre} » a des modifications non enregistrées. Elles seront perdues.`,
        confirmer: "Quitter sans enregistrer",
      });
      if (!ok) return;
      setModifie(false);
    }
    naviguer(vers);
  }

  // Enregistre des colonnes de l'école puis recharge le profil (nom, couleurs,
  // modules… sont lus partout depuis le profil).
  const majEtablissement = async (champs) => { await majEcole(ecoleId, champs); await rafraichirProfil(); };

  const props = { ecoleId, ecole, onErreur: setErreur };
  const RUBRIQUES = {
    identite: () => <Identite {...props} onSave={majEtablissement} />,
    couverture: () => <Couverture {...props} onSave={majEtablissement} />,
    apparence: () => <Apparence {...props} onSave={majEtablissement} />,
    notation: () => <NotationConfig {...props} />,
    signataires: () => <Signataires {...props} />,
    "champs-eleve": () => <ChampsEleveConfig {...props} />,
    matricule: () => <Matricule ecole={ecole}
      onSave={async (v) => { await majConfigMatricule(ecoleId, v); await rafraichirProfil(); }} />,
    relances: () => <RelancesConfig ecoleId={ecoleId} estGestion={estComplet} />,
    "paiement-en-ligne": () => <PaiementEnLigne onErreur={setErreur} />,
    modules: () => <ModulesActifs ecole={ecole} onSave={(mods) => majEtablissement({ modules_actifs: mods })} />,
  };

  return (
    <>
      <EnTete
        titre="Paramètres"
        sousTitre={estComplet ? "Configuration de l'établissement" : "Les réglages de votre domaine"}
      />
      <div className="p-4 sm:p-8 lg:flex lg:items-start lg:gap-8">
        {/* Ordinateur : menu des rubriques, toujours visible. */}
        <nav aria-label="Rubriques des paramètres"
          className="sticky top-4 hidden w-60 shrink-0 space-y-4 lg:block">
          {groupes.map((g) => (
            <div key={g.groupe}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-navy-900/65">{g.groupe}</p>
              <ul className="space-y-0.5">
                {g.rubriques.map((r) => {
                  const active = r.id === courante?.id;
                  return (
                    <li key={r.id}>
                      <a href={`#/parametres/${r.id}`} onClick={(e) => aller(`/parametres/${r.id}`, e)}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${active
                          ? "bg-navy-900 font-medium text-creme"
                          : "text-navy-900/80 hover:bg-navy-900/5"}`}>
                        <span className="min-w-0 flex-1 truncate">{r.titre}</span>
                        {active && modifie && <span aria-label="non enregistré" className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Téléphone, sans rubrique : la liste. */}
        {!rubrique && (
          <div className="space-y-5 lg:hidden">
            {groupes.map((g) => (
              <div key={g.groupe}>
                <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-navy-900/65">{g.groupe}</p>
                <ul className="divide-y divide-navy-900/10 overflow-hidden rounded-2xl border border-navy-900/10 bg-white">
                  {g.rubriques.map((r) => (
                    <li key={r.id}>
                      <Link to={`/parametres/${r.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-creme">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-navy-900">{r.titre}</span>
                          <span className="block truncate text-xs text-navy-900/65">{r.resume}</span>
                        </span>
                        <span aria-hidden="true" className="text-lg text-navy-900/65">›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {visibles.length === 0 && (
          <p className="text-sm text-navy-900/70">Aucun réglage ne relève de votre rôle.</p>
        )}

        {/* La rubrique. Sur téléphone, seulement si l'adresse en désigne une. */}
        {courante && (
          <div ref={contenuRef} className={`min-w-0 max-w-2xl flex-1 ${rubrique ? "" : "hidden lg:block"}`}>
            <a href="#/parametres" onClick={(e) => aller("/parametres", e)}
              className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-navy-700 lg:hidden">
              ‹ Paramètres
            </a>
            <p className="hidden text-xs text-navy-900/65 lg:block">{courante.groupe}</p>
            <h2 className="mb-4 font-display text-xl font-semibold text-navy-900">{courante.titre}</h2>
            <Alerte ton="erreur">{erreur}</Alerte>
            <FournisseurModif value={setModifie}>
              {/* key : changer de rubrique repart d'un formulaire neuf. */}
              <div key={courante.id}>{RUBRIQUES[courante.id]()}</div>
            </FournisseurModif>
          </div>
        )}
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
      <div className="mb-1 flex items-center justify-end">
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
                className="text-xs font-medium text-rose-700 hover:text-rose-800">suppr.</button>
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

// La fiche Établissement, coupée en trois rubriques. Chacune n'envoie QUE
// ses colonnes : enregistrer les couleurs ne renvoie plus le nom, et une
// erreur sur l'une ne bloque plus les deux autres.
const champSelect = "w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500";

function Identite({ ecole, onSave }) {
  const form = useFormulaire({
    nom: ecole?.nom || "", sigle: ecole?.sigle || "", devise: ecole?.devise || "XOF",
    pays: ecole?.pays || "Sénégal", ville: ecole?.ville || "", adresse: ecole?.adresse || "",
    telephone: ecole?.telephone || "", email: ecole?.email || "",
  });
  const { valeur: f, maj, setValeur } = form;
  return (
    <Carte className="p-6">
      <p className="mb-4 text-xs text-navy-900/65">Apparaît sur les factures, bulletins et documents officiels.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ label="Nom" value={f.nom} onChange={(e) => maj("nom", e.target.value)} />
        <Champ label="Sigle" value={f.sigle} onChange={(e) => maj("sigle", e.target.value.toUpperCase())} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Pays</span>
          <select value={f.pays} className={champSelect}
            onChange={(e) => { const p = e.target.value; setValeur((s) => ({ ...s, pays: p, devise: deviseDuPays(p) })); }}>
            {PAYS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Devise</span>
          <select value={f.devise} onChange={(e) => maj("devise", e.target.value)} className={champSelect}>
            {DEVISES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <Champ label="Ville" value={f.ville} onChange={(e) => maj("ville", e.target.value)} placeholder="Dakar" />
        <Champ label="Adresse" value={f.adresse} onChange={(e) => maj("adresse", e.target.value)} />
        <Champ label="Téléphone" value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} />
        <Champ label="E-mail" type="email" value={f.email} onChange={(e) => maj("email", e.target.value)} />
      </div>
      <PiedEnregistrer modifie={form.modifie} onAnnuler={form.annuler}
        desactive={!f.nom.trim()}
        onEnregistrer={async () => { await onSave(f); form.valider(); }} />
    </Carte>
  );
}

function Couverture({ ecole, onSave }) {
  //  ⚠️ L'ORDRE DE MISE EN LIGNE NE DOIT PAS COMPTER. Si la migration 168
  //  n'est pas encore appliquee, les colonnes `paliers` et
  //  `pedagogie_elementaire` n'existent pas : les envoyer ferait echouer
  //  l'enregistrement. On sonde leur presence — un `select *` rend la cle
  //  des que la colonne existe, meme a NULL — et on s'abstient tant qu'elle manque.
  const paliersDispo = Boolean(ecole) && "paliers" in ecole;
  const form = useFormulaire({
    //  On montre ce que l'ecole a DECLARE. Vide = non declare : on
    //  n'affiche pas le repli du menu comme si c'etait sa reponse.
    paliers: ecole ? paliersDeclares(ecole) : [],
    pedagogie_elementaire: ecole?.pedagogie_elementaire || "",
    type_etablissement: ecole?.type_etablissement || "ecole",
  });
  const { valeur: f, maj } = form;
  if (!paliersDispo) {
    return (
      <Carte className="p-6">
        <p className="text-sm text-navy-900/70">Ce réglage sera disponible après la prochaine mise à jour de la base.</p>
      </Carte>
    );
  }
  return (
    <Carte className="p-6">
      <ChoixPaliers
        paliers={f.paliers} pedagogie={f.pedagogie_elementaire}
        onPaliers={(v) => maj("paliers", v)}
        onPedagogie={(v) => maj("pedagogie_elementaire", v)}
      />
      <PiedEnregistrer modifie={form.modifie} onAnnuler={form.annuler}
        onEnregistrer={async () => { await onSave(profilAEnregistrer(f, paliersDispo)); form.valider(); }} />
    </Carte>
  );
}

function Apparence({ ecoleId, ecole, onSave, onErreur }) {
  const form = useFormulaire({
    logo_url: ecole?.logo_url || null, cachet_url: ecole?.cachet_url || null,
    couleur_primaire: ecole?.couleur_primaire || "#0B1F3A",
    couleur_secondaire: ecole?.couleur_secondaire || "#C9A227",
  });
  const { valeur: f, maj } = form;
  const [up, setUp] = useState("");
  // Si l'aperçu live n'est pas enregistré, rétablir l'accent sauvegardé au départ.
  useEffect(() => () => appliquerAccent(ecole?.couleur_secondaire), [ecole?.couleur_secondaire]);
  const accent = (c) => { maj("couleur_secondaire", c); appliquerAccent(c); };

  async function televerser(champ, file, prefixe) {
    if (!file) return;
    setUp(champ); onErreur?.("");
    try { maj(champ, await televerserAsset(ecoleId, file, prefixe)); }
    catch (e) { onErreur?.(e.message); }
    finally { setUp(""); }
  }

  return (
    <Carte className="p-6">
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AssetUpload label="Logo de l'école" valeur={f.logo_url} occupe={up === "logo_url"}
          onFichier={(file) => televerser("logo_url", file, "logo")} onRetirer={() => maj("logo_url", null)} />
        <AssetUpload label="Cachet (image)" valeur={f.cachet_url} occupe={up === "cachet_url"}
          onFichier={(file) => televerser("cachet_url", file, "cachet")} onRetirer={() => maj("cachet_url", null)} />
      </div>

      <div className="flex items-end gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Couleur principale</span>
          <input type="color" value={f.couleur_primaire} onChange={(e) => maj("couleur_primaire", e.target.value)}
            className="h-10 w-16 rounded-lg border border-navy-900/15" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Accent</span>
          <input type="color" value={f.couleur_secondaire} onChange={(e) => accent(e.target.value)}
            className="h-10 w-16 rounded-lg border border-navy-900/15" />
        </label>
      </div>

      {/* Aperçu live de l'accent + explication */}
      <div className="mt-4 rounded-xl border border-navy-900/10 bg-creme/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-navy-900/70">Aperçu de l'accent :</span>
          <button type="button" className="rounded-lg bg-or-500 px-4 py-1.5 text-sm font-semibold text-white">Bouton</button>
          <span className="text-sm font-semibold text-or-600">Lien actif</span>
          <span className="rounded-full bg-or-500/10 px-3 py-1 text-xs font-medium text-or-600">Badge</span>
          <span className="rounded-lg bg-navy-900 px-3 py-1 text-sm font-semibold text-or-500">Sur l'en-tête</span>
          <button type="button" onClick={() => accent(COULEUR_DEFAUT)}
            className="ml-auto text-xs text-navy-900/50 underline">Rétablir l'accent d'origine</button>
        </div>
        <p className="mt-2 text-xs text-navy-900/50">
          L'accent colore les boutons, liens et éléments actifs de toute l'application. Le navy reste fixe pour la lisibilité.
          Sur fond clair, ses textes sont foncés automatiquement pour rester lisibles.
        </p>
        {/* Les textes sur fond clair sont garantis par le calcul (theme.js) ;
            l'accent sur le navy des en-têtes, lui, est la couleur choisie telle
            quelle — une couleur foncée y devient illisible. On le dit. */}
        {accentPeuVisible(f.couleur_secondaire) && (
          <p className="mt-2 text-xs font-medium text-amber-800">
            ⚠️ Cette couleur est trop foncée pour ressortir sur le bleu marine des en-têtes (logo, menus actifs).
            Choisissez une teinte plus claire ou plus vive.
          </p>
        )}
      </div>

      <PiedEnregistrer modifie={form.modifie} desactive={Boolean(up)}
        onAnnuler={() => { form.annuler(); appliquerAccent(form.base.couleur_secondaire); }}
        onEnregistrer={async () => { await onSave(f); form.valider(); }} />
    </Carte>
  );
}

function ModulesActifs({ ecole, onSave }) {
  // null en base = tous actifs. Tableau trié : l'ordre des clics ne doit pas
  // faire croire à une modification.
  const form = useFormulaire(ecole ? [...(ecole.modules_actifs ?? tousLesModules())].sort() : []);
  const actifs = new Set(form.valeur);
  const toggle = (id) => form.setValeur((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id].sort()));

  return (
    <Carte className="p-6">
      <p className="mb-4 text-xs text-navy-900/65">
        Active ou désactive des modules pour cet établissement. Un module désactivé disparaît
        des menus et son accès est bloqué.
      </p>
      <div className="space-y-2">
        {MODULES.map((m) => (
          <label key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-navy-900/10 px-4 py-3">
            <span>
              <span className="font-medium text-navy-900">{m.label}</span>
              <span className="ml-2 text-xs text-navy-900/50">{m.desc}</span>
            </span>
            <input type="checkbox" checked={actifs.has(m.id)} onChange={() => toggle(m.id)} className="h-5 w-5 shrink-0" />
          </label>
        ))}
      </div>
      <PiedEnregistrer modifie={form.modifie} onAnnuler={form.annuler}
        onEnregistrer={async () => { await onSave(form.valeur); form.valider(); }} />
    </Carte>
  );
}

function Matricule({ ecole, onSave }) {
  const form = useFormulaire({
    prefixe: ecole?.matricule_prefixe ?? "",
    separateur: ecole?.matricule_separateur ?? "-",
    longueur: ecole?.matricule_longueur ?? 4,
    annee: ecole?.matricule_annee ? String(ecole.matricule_annee) : "",
  });
  const { valeur: f, maj } = form;
  const anEff = f.annee ? Number(f.annee) : new Date().getFullYear();
  const aa = String(anEff % 100).padStart(2, "0");
  const seq = "1".padStart(Math.max(1, Number(f.longueur) || 4), "0");
  const apercu = (f.prefixe ? f.prefixe + (f.separateur || "-") : "") + aa + (f.separateur || "-") + seq;
  return (
    <Carte className="p-6">
      <p className="mb-4 text-xs text-navy-900/65">Format : {"{PRÉFIXE}{SÉP}{AA}{SÉP}{SÉQUENCE}"}. La séquence repart à 1 par année.</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Champ label="Préfixe" value={f.prefixe} onChange={(e) => maj("prefixe", e.target.value.toUpperCase())} placeholder="GS" />
        <Champ label="Séparateur" value={f.separateur} onChange={(e) => maj("separateur", e.target.value.slice(0, 1))} placeholder="-" />
        <Champ label="Chiffres" type="number" min="1" max="8" value={f.longueur} onChange={(e) => maj("longueur", e.target.value.replace(/\D/g, ""))} />
        <Champ label="Année" type="number" value={f.annee} placeholder="auto"
          onChange={(e) => maj("annee", e.target.value.replace(/\D/g, "").slice(0, 4))} />
      </div>
      <p className="mt-2 text-xs text-navy-900/40">
        <b>Année</b> : fixez-la (ex. 2026) pour que toute une rentrée ait le même « {aa} », quelle que soit la date de saisie.
        Laissez <b>vide</b> pour l'année civile automatique. Les matricules déjà attribués ne changent pas.
      </p>
      <p className="mt-4 text-sm text-navy-900/60">Aperçu : <span className="font-mono text-base font-semibold text-navy-900">{apercu}</span></p>
      <PiedEnregistrer modifie={form.modifie} onAnnuler={form.annuler}
        onEnregistrer={async () => { await onSave(f); form.valider(); }} />
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
          {valeur && <button onClick={onRetirer} className="ml-3 text-rose-700 hover:underline">retirer</button>}
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
  // La liste s'enregistre à chaque ajout ; seul un champ commencé et pas
  // encore ajouté serait perdu en changeant de rubrique.
  useSignalModif(Boolean(f.libelle.trim()));

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
      <p className="mb-4 text-xs text-navy-900/40">
        Ajoutez des informations propres à votre école (ex. groupe sanguin, personne à contacter…). Elles apparaissent sur la <b>fiche élève</b>.
      </p>
      {info && <p className="mb-2 text-sm text-emerald-700">{info}</p>}

      <div className="space-y-2">
        {liste.length === 0 && <p className="text-sm text-navy-900/40">Aucun champ personnalisé.</p>}
        {liste.map((c, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-navy-900/10 px-4 py-2">
            <span className="text-sm">
              <b className="text-navy-900">{c.libelle}</b>
              <span className="ml-2 text-xs text-navy-900/40">· {TYPES_CHAMP.find((t) => t[0] === c.type)?.[1]}{c.type === "liste" && c.options?.length ? ` (${c.options.join(", ")})` : ""}</span>
            </span>
            <button onClick={() => sauver(liste.filter((_, j) => j !== i))} className="text-xs text-rose-700 hover:underline">retirer</button>
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
  const [enregistree, setEnregistree] = useState(DEFAUT_NOTATION);
  const form = useFormulaire(enregistree);
  const { valeur: cfg, setValeur: setCfg } = form;
  useEffect(() => { getNotationConfig(ecoleId).then(setEnregistree).catch((e) => onErreur?.(e.message)); }, [ecoleId]); // eslint-disable-line

  const maj = (k, v) => setCfg((s) => ({ ...s, [k]: v }));
  const majMention = (i, k, v) => setCfg((s) => ({ ...s, mentions: s.mentions.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));

  // Une erreur remonte au pied, qui l'affiche (toast) et garde la saisie.
  async function sauver() {
    const clean = {
      ...cfg,
      bareme: Number(cfg.bareme) || 20,
      moyenne_passage: Number(cfg.moyenne_passage) || 0,
      mentions: (cfg.mentions || []).filter((m) => (m.libelle || "").trim())
        .map((m) => ({ min: Number(m.min) || 0, libelle: m.libelle.trim() }))
        .sort((a, b) => b.min - a.min),
    };
    await setNotationConfig(ecoleId, clean);
    form.valider(clean);
  }

  return (
    <Carte className="p-6">
      <p className="mb-4 text-xs text-navy-900/65">
        Barème, moyenne de passage, mentions et options d'affichage. <b>Recalculez</b> les bulletins après un changement.
      </p>

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
            <button onClick={() => setCfg((s) => ({ ...s, mentions: s.mentions.filter((_, j) => j !== i) }))} className="text-xs text-rose-700 hover:underline">retirer</button>
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

      <PiedEnregistrer modifie={form.modifie} onAnnuler={form.annuler} onEnregistrer={sauver} />
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
  useSignalModif(Boolean(f.fonction.trim() || f.nom.trim() || f.signature_url));
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
      <p className="mb-4 text-xs text-navy-900/40">
        Responsables et leur signature scannée — proposés sur les documents officiels (certificats, bulletins…).
      </p>
      {info && <p className="mb-2 text-sm text-emerald-700">{info}</p>}

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
            <button onClick={() => sauver(liste.filter((_, j) => j !== i))} className="text-xs text-rose-700 hover:underline">retirer</button>
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

// Configuration du paiement en ligne (secrets prestataire). Promoteur uniquement.
// Les clés ne sont jamais relues : on affiche seulement si elles sont saisies.
function PaiementEnLigne({ onErreur }) {
  const toast = useToast();
  const [etat, setEtat] = useState(null);
  const [f, setF] = useState({ prestataire: "cinetpay", mode: "test", commission_a_charge: "ecole", commission_taux: 0.035, api_key: "", site_id: "", secret_webhook: "" });
  const [envoi, setEnvoi] = useState(false);
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paiement/webhook`;

  const recharger = useCallback(async () => {
    try {
      const e = await pspEtat();
      setEtat(e);
      setF((s) => ({
        ...s,
        prestataire: e.prestataire || "cinetpay",
        mode: e.mode || "test",
        commission_a_charge: e.commission_a_charge || "ecole",
        commission_taux: e.commission_taux ?? 0.035,
      }));
    } catch (e) { onErreur?.(e.message); }
  }, [onErreur]);
  useEffect(() => { recharger(); }, [recharger]);

  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  // Clé saisie ou réglage changé et pas encore enregistré.
  const modifie = Boolean(f.api_key || f.site_id || f.secret_webhook) || (etat !== null && (
    f.prestataire !== (etat.prestataire || "cinetpay") || f.mode !== (etat.mode || "test")
    || f.commission_a_charge !== (etat.commission_a_charge || "ecole")
    || f.commission_taux !== (etat.commission_taux ?? 0.035)));
  useSignalModif(modifie);
  async function sauver(activer) {
    setEnvoi(true);
    try {
      await setPspConfig({ ...f, actif: activer });
      // On ne renvoie pas les clés vides pour ne pas écraser celles en base.
      setF((s) => ({ ...s, api_key: "", site_id: "", secret_webhook: "" }));
      await recharger();
      toast.succes(activer === false ? "Paiement en ligne désactivé." : "Configuration enregistrée.");
    } catch (e) { toast.erreur(e.message); }
    finally { setEnvoi(false); }
  }

  const champ = "w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-or-500";
  const estPD = f.prestataire === "paydunya";

  return (
    <Carte className="p-6">
      <div className="mb-2 flex items-center justify-end">
        {etat?.actif
          ? <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Activé · {etat.mode === "live" ? "production" : "test"}</span>
          : <span className="rounded-full bg-navy-900/5 px-2.5 py-0.5 text-xs text-navy-900/50">Inactif</span>}
      </div>
      <p className="mb-4 text-xs text-navy-900/45">
        Permets aux parents de régler la scolarité par Wave / Orange Money / carte. L'argent va
        <b> directement sur ton compte marchand</b> ; la facture se solde automatiquement. Commence en
        <b> mode test</b> (bac à sable) avant d'activer la production.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Prestataire</span>
          <select value={f.prestataire} onChange={(e) => maj("prestataire", e.target.value)} className={champ}>
            {PRESTATAIRES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Environnement</span>
          <select value={f.mode} onChange={(e) => maj("mode", e.target.value)} className={champ}>
            <option value="test">Test (bac à sable)</option>
            <option value="live">Production</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">
            {estPD ? "Private key (PayDunya)" : "API key (CinetPay)"}
            {etat?.cles_saisies && <span className="ml-1 text-xs text-emerald-700">✓ enregistrée</span>}
          </span>
          <input type="password" value={f.api_key} onChange={(e) => maj("api_key", e.target.value)}
            placeholder={etat?.cles_saisies ? "•••••• (laisser vide pour garder)" : ""} className={champ} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">{estPD ? "Master key" : "Site ID"}</span>
          <input type="password" value={f.site_id} onChange={(e) => maj("site_id", e.target.value)}
            placeholder={etat?.cles_saisies ? "•••••• (laisser vide pour garder)" : ""} className={champ} />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-medium text-navy-900/70">
          {estPD ? "Token PayDunya (ou master|private|token)" : "Secret (clé de vérification)"}
          {etat?.secret_saisi && <span className="ml-1 text-xs text-emerald-700">✓ enregistré</span>}
        </span>
        <input type="password" value={f.secret_webhook} onChange={(e) => maj("secret_webhook", e.target.value)}
          placeholder={etat?.secret_saisi ? "•••••• (laisser vide pour garder)" : ""} className={champ} />
      </label>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Frais de transaction</span>
          <select value={f.commission_a_charge} onChange={(e) => maj("commission_a_charge", e.target.value)} className={champ}>
            <option value="ecole">À ma charge (l'école absorbe)</option>
            <option value="parent">À la charge du parent (ajoutés)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Taux estimé des frais (%)</span>
          <input type="number" step="0.1" value={Math.round((f.commission_taux || 0) * 1000) / 10}
            onChange={(e) => maj("commission_taux", (Number(e.target.value) || 0) / 100)} className={champ} />
        </label>
      </div>

      <div className="mt-4 rounded-xl bg-creme px-4 py-3">
        <p className="text-xs font-medium text-navy-900/60">URL de notification (webhook) à coller chez le prestataire :</p>
        <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-[11px] text-navy-900/70">{webhookUrl}</code>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {modifie && (
          <span className="mr-auto flex items-center gap-2 text-sm font-medium text-amber-800">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-400" />Non enregistré
          </span>
        )}
        {etat?.actif && <Bouton variante="fantome" onClick={() => sauver(false)} disabled={envoi}>Désactiver</Bouton>}
        <Bouton variante="fantome" onClick={() => sauver(null)} disabled={envoi}>Enregistrer</Bouton>
        <Bouton variante="or" onClick={() => sauver(true)} disabled={envoi}>Enregistrer &amp; activer</Bouton>
      </div>
    </Carte>
  );
}

// =====================================================================
//  Ce que l'établissement couvre, et sa pédagogie (mig. 168)
//
//  Demandé : Élémentaire (incluant le préscolaire), Collège, Lycée,
//  Université — ET leurs combinaisons, du plus simple au plus étendu.
//
//  ⚠️ COMMENT LE CHOIX EST RENDU AISÉ. Quinze combinaisons dans une liste
//  déroulante serait illisible, et l'école devrait chercher la sienne. On
//  propose donc les cas COURANTS en un clic — formulés comme l'école les
//  dit — et les cases à cocher juste en dessous pour tout cas particulier.
//  Les deux sont le même état : cliquer un cas courant coche les cases, et
//  décocher une case fait simplement perdre le nom du cas courant.
// =====================================================================
function ChoixPaliers({ paliers, pedagogie, onPaliers, onPedagogie }) {
  const actuel = combinaisonDe(paliers);
  const manquant = trou(paliers);
  const basculer = (cle) => onPaliers(
    paliers.includes(cle) ? paliers.filter((p) => p !== cle) : [...paliers, cle]);

  return (
    <div className="rounded-xl border border-navy-900/10 p-4">
      <span className="block text-sm font-medium text-navy-900/70">Ce que l&apos;établissement couvre</span>
      <p className="mt-1 text-xs text-navy-900/45">
        Du plus simple — l&apos;élémentaire seul — au plus étendu : élémentaire, collège, lycée et université.
      </p>

      {/* Les cas courants, en un clic. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {COMBINAISONS.map((c) => (
          <button key={c.cle} type="button" onClick={() => onPaliers([...c.paliers])}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${actuel?.cle === c.cle
              ? "bg-navy-900 text-creme"
              : "bg-navy-900/5 text-navy-900/70 hover:bg-navy-900/10"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Et les cases à cocher pour l'exact. */}
      <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {PALIERS.map((p) => {
          const coche = paliers.includes(p.cle);
          return (
            <label key={p.cle}
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${coche
                ? "border-or-500/50 bg-or-500/[0.06]" : "border-navy-900/10 hover:bg-creme/60"}`}>
              <input type="checkbox" checked={coche} onChange={() => basculer(p.cle)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-or-500" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-navy-900">{p.label}</span>
                {p.detail && <span className="block text-xs text-navy-900/45">{p.detail}</span>}
              </span>
            </label>
          );
        })}
      </div>

      {/* Ce que l'école vient de déclarer, en une phrase. */}
      <div className="mt-3 text-sm">
        {paliers.length === 0 ? (
          <span className="text-navy-900/45">
            Rien de déclaré : l&apos;établissement continue de fonctionner comme aujourd&apos;hui.
          </span>
        ) : (
          <span className="text-navy-900/70">
            Déclaré : <b className="text-navy-900">{resumePaliers(paliers)}</b>
          </span>
        )}
      </div>

      {/* ⚠️ On SIGNALE un trou dans l'échelle, sans l'interdire : une école
          peut fermer son collège le temps d'un chantier. */}
      {manquant && (
        <p className="mt-2 text-xs text-amber-700">
          Le {manquant.toLowerCase()} est absent entre deux paliers déclarés. Si c&apos;est voulu, ignorez ce message.
        </p>
      )}

      {couvreSuperieur({ paliers }) && (
        <p className="mt-2 text-xs text-navy-900/45">
          Le palier « Université » ouvre l&apos;espace LMD : filières et maquettes (UE, crédits, semestres),
          inscriptions, délibérations. Il s&apos;ajoute aux pages scolaires si l&apos;établissement couvre aussi
          l&apos;élémentaire, le collège ou le lycée.
        </p>
      )}

      {/* La pédagogie : seulement si l'élémentaire est couvert. */}
      {pedagogiePertinente(paliers) && (
        <div className="mt-4 border-t border-navy-900/10 pt-3.5">
          <span className="block text-sm font-medium text-navy-900/70">Pédagogie de l&apos;élémentaire</span>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {PEDAGOGIES.map((pg) => (
              <label key={pg.cle}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${pedagogie === pg.cle
                  ? "border-or-500/50 bg-or-500/[0.06]" : "border-navy-900/10 hover:bg-creme/60"}`}>
                <input type="radio" name="pedagogie" checked={pedagogie === pg.cle}
                  onChange={() => onPedagogie(pg.cle)} className="mt-0.5 h-4 w-4 shrink-0 accent-or-500" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-navy-900">{pg.label}</span>
                  <span className="block text-xs text-navy-900/45">{pg.detail}</span>
                </span>
              </label>
            ))}
          </div>
          {pedagogie === "montessori" && (
            <p className="mt-2 text-xs text-navy-900/50">
              Une classe Montessori réunit plusieurs niveaux. Précisez le niveau réel de chaque élève
              avec les <b>sous-niveaux</b>, dans Structure → Niveaux &amp; classes.
            </p>
          )}
          {pedagogie && (
            <button type="button" onClick={() => onPedagogie("")}
              className="mt-2 text-xs text-navy-900/40 hover:underline">ne pas préciser</button>
          )}
        </div>
      )}
    </div>
  );
}
