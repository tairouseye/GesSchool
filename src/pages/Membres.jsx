import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale, Recherche, filtreTexte, EtatVide, SkeletonListe } from "@/composants/ui.jsx";
import { LIBELLES_ROLES, rolesInvitables, estRoleComplet } from "@/lib/permissions.js";
import { MODELES, POUVOIRS, arbreDesCases, boitesDeLArbre } from "@/lib/acces.js";
import { getMembres, inviterMembre, revoquerRole, suspendreMembre, lienInvitation, getInvitations, annulerInvitation, accorderModele, getPerimetres, definirPerimetre, getAccesDuMembre, definirAcces } from "@/lib/membres.js";
import { getCycles } from "@/lib/academique.js";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";

export default function Membres() {
  const { roles, ecole, profil } = useAuth();
  const confirmer = useConfirm();
  const toast = useToast();
  //  L'établissement est passé : on ne propose pas « Bibliothécaire » à une
  //  école élémentaire, dont aucun écran de bibliothèque n'est ouvert.
  const invitables = rolesInvitables(roles, ecole); // rôles que je peux déléguer
  const complet = estRoleComplet(roles);

  const [membres, setMembres] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [modale, setModale] = useState(false);
  const [q, setQ] = useState("");
  //  Périmètres et cycles : chargés seulement si l'école a plus d'un cycle.
  //  Proposer « un seul cycle » à une école qui n'en a qu'un serait un réglage
  //  sans effet, et un réglage sans effet est un piège.
  const [perimetres, setPerimetres] = useState({});
  const [cycles, setCycles] = useState([]);
  //  Le membre dont on règle les accès case par case (mig. 199).
  const [regle, setRegle] = useState(null);

  // Recherche sur le nom, l'e-mail et le libellé lisible des rôles.
  const membresFiltres = filtreTexte(membres, q, [
    "prenom", "nom", "email",
    (m) => (m.roles || []).map((r) => LIBELLES_ROLES[r] || r).join(" "),
  ]);

  const charger = useCallback(async () => {
    setErreur("");
    try {
      const [m, inv] = await Promise.all([getMembres(), getInvitations()]);
      setMembres(m);
      setInvitations(inv);
      //  ⚠️ DÉGRADATION GRACIEUSE, patron de `Structure.jsx` : le périmètre
      //  est un ajout récent (mig. 188-190). Si ces RPC manquent — base pas
      //  encore migrée — la page des membres doit rester utilisable, pas
      //  afficher une erreur pour une fonctionnalité annexe.
      if (complet) {
        try {
          const [per, cy] = await Promise.all([getPerimetres(), getCycles(ecole?.id)]);
          setPerimetres(per);
          setCycles(cy || []);
        } catch { /* périmètre indisponible : on n'affiche pas le sélecteur */ }
      }
    } catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [complet, ecole?.id]);

  useEffect(() => { charger(); }, [charger]);

  //  Index des cycles par identifiant, pour nommer le périmètre dans la
  //  confirmation et sur la ligne du membre.
  const cyclesParId = Object.fromEntries((cycles || []).map((c) => [c.id, c]));

  // Puis-je gérer ce rôle précis ?
  const gereRole = (r) => complet || invitables.includes(r);

  async function retirer(m, r) {
    if (!(await confirmer(`Retirer le rôle « ${LIBELLES_ROLES[r] || r} » à ${m.prenom} ${m.nom} ?`))) return;
    setErreur("");
    try {
      await revoquerRole(m.id, r);
      toast.succes("Rôle retiré.");
      await charger();
    } catch (e) { setErreur(e.message); toast.erreur(e.message); }
  }

  //  Accorder un accès à un membre qui est déjà là — sans code, sans
  //  réinscription. Réservé au promoteur, comme la base l'exige.
  async function accorder(m, modele) {
    const lib = MODELES.find((x) => x.id === modele)?.label || modele;
    if (!(await confirmer({
      message: `Donner à ${m.prenom} ${m.nom} l'accès « ${lib} » ? Ses accès actuels sont conservés.`,
      confirmer: "Donner l'accès",
    }))) return;
    setErreur("");
    try {
      await accorderModele(m.id, modele);
      toast.succes(`Accès « ${lib} » accordé.`);
      await charger();
    } catch (e) { setErreur(e.message); toast.erreur(e.message); }
  }

  //  Poser le périmètre d'un membre : toute l'école, ou UN cycle.
  //
  //  ⚠️ ON NE PROPOSE PAS « plusieurs cycles » dans ce sélecteur, alors que la
  //  base l'accepte. Un responsable qui tient deux cycles est un cas réel
  //  mais rare, et un sélecteur multiple ici coûterait en clarté à tout le
  //  monde. La RPC prend un tableau : le jour où le besoin apparaît, l'écran
  //  suit sans migration.
  async function reglerPerimetre(m, valeur) {
    const mode = valeur === "ecole" ? "ecole" : "cycles";
    const cycles = mode === "cycles" ? [valeur] : [];
    const libelle = mode === "ecole"
      ? "toute l'école"
      : (cyclesParId[valeur]?.libelle || "ce cycle");
    if (!(await confirmer({
      message: `${m.prenom} ${m.nom} ne verra plus que « ${libelle} ». Les élèves, factures, bulletins et absences des autres cycles disparaîtront de ses écrans.`,
      confirmer: "Appliquer",
    }))) return;
    setErreur("");
    try {
      await definirPerimetre(m.id, mode, cycles);
      toast.succes(mode === "ecole"
        ? `${m.prenom} voit de nouveau toute l'école.`
        : `${m.prenom} est limitée à « ${libelle} ».`);
      await charger();
    } catch (e) { setErreur(e.message); toast.erreur(e.message); }
  }

  async function suspendre(m, suspendu) {
    if (suspendu && !(await confirmer({ message: `Suspendre l'accès de ${m.prenom} ${m.nom} ?`, confirmer: "Suspendre" }))) return;
    setErreur("");
    try {
      await suspendreMembre(m.id, suspendu);
      toast.succes(suspendu ? "Membre suspendu." : "Membre réactivé.");
      await charger();
    } catch (e) { setErreur(e.message); toast.erreur(e.message); }
  }

  async function annuler(inv) {
    if (!(await confirmer(`Annuler l'invitation ${inv.code} (${LIBELLES_ROLES[inv.role] || inv.role}) ?`))) return;
    setErreur("");
    try {
      await annulerInvitation(inv.id);
      toast.succes("Invitation annulée.");
      await charger();
    } catch (e) { setErreur(e.message); toast.erreur(e.message); }
  }

  const copierLien = async (code) => {
    try { await navigator.clipboard.writeText(lienInvitation(code)); toast.succes("Lien copié."); } catch { toast.erreur("Copie impossible."); }
  };
  const dateCourte = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "");

  return (
    <>
      <EnTete titre="Membres de l'équipe" sousTitre="Gérez les accès de votre établissement" />
      <div className="space-y-5 p-8">
        <Alerte ton="erreur">{erreur}</Alerte>

        <div className="flex items-center justify-between">
          <p className="text-sm text-navy-900/60">
            {membres.length} membre{membres.length > 1 ? "s" : ""}
          </p>
          {invitables.length > 0 && (
            <Bouton onClick={() => setModale(true)}>+ Inviter un membre</Bouton>
          )}
        </div>

        {membres.length > 8 && (
          <Recherche valeur={q} onChange={setQ} placeholder="Rechercher un membre (nom, e-mail, rôle)…" className="max-w-sm" />
        )}

        {/*  ⚠️ L'ÉTAT VIDE DOIT ATTENDRE LA RÉPONSE. Sans ce témoin, la page
            annonçait « Aucun membre » pendant tout le chargement : un état
            vide affirme quelque chose de faux, c'est pire qu'une attente. */}
        {chargement ? (
          <SkeletonListe lignes={4} />
        ) : membres.length === 0 ? (
          <EtatVide icone="👥" titre="Aucun membre"
            action={invitables.length > 0 ? <Bouton onClick={() => setModale(true)}>+ Inviter un membre</Bouton> : null}>
            Invitez les responsables et le personnel de votre établissement pour qu'ils accèdent à leur espace.
          </EtatVide>
        ) : membresFiltres.length === 0 ? (
          <Carte className="p-8 text-sm text-navy-900/50">Aucun membre ne correspond à « {q} ».</Carte>
        ) : (
        <Carte className="divide-y divide-navy-900/5">
          {(
            membresFiltres.map((m) => {
              const estMoi = m.id === profil?.id;
              const rolesGerables = (m.roles || []).filter(gereRole);
              const peutGerer = !estMoi && (complet || rolesGerables.length > 0);
              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-navy-900">
                      {m.prenom} {m.nom}
                      {estMoi && <span className="rounded bg-navy-900/10 px-1.5 py-0.5 text-[10px] text-navy-900/60">vous</span>}
                      {m.actif === false && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">suspendu</span>}
                    </p>
                    <p className="text-xs text-navy-900/50">{m.email || "—"}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {(m.roles || []).length === 0 && <span className="text-xs text-navy-900/40">aucun rôle</span>}
                      {(m.roles || []).map((r) => (
                        <span key={r} className="inline-flex items-center gap-1 rounded-lg bg-or-500/10 px-2 py-0.5 text-xs text-navy-800">
                          {LIBELLES_ROLES[r] || r}
                          {peutGerer && gereRole(r) && (
                            <button onClick={() => retirer(m, r)} title="Retirer ce rôle"
                              className="text-rose-500 hover:text-rose-700">✕</button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                  {peutGerer && (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {/*  ⚠️ LE PROMOTEUR SEUL, parce que la base le refuse aux
                           autres : proposer le choix à la direction la mènerait
                           à un message d'erreur, pas à un accès. */}
                      {complet && (() => {
                        const aDonner = MODELES.filter((x) => !(m.roles || []).includes(x.id));
                        if (!aDonner.length) return null;
                        return (
                          <select defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value = ""; if (v) accorder(m, v); }}
                            className="rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-xs text-navy-900 outline-none focus:border-or-500"
                            aria-label={`Donner un accès à ${m.prenom} ${m.nom}`}>
                            <option value="">+ Donner un accès…</option>
                            {aDonner.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                          </select>
                        );
                      })()}
                      {/*  ⚠️ RÉGLER LES ACCÈS CASE PAR CASE (mig. 199-200).
                           Le promoteur seul : la base refuse `definir_acces`
                           aux autres, donc l'offrir à la direction la mènerait
                           à un message d'erreur, pas à un réglage. */}
                      {complet && (
                        <Bouton variante="fantome" className="!py-1.5 text-xs"
                          onClick={() => setRegle(m)}>⚙ Accès détaillés</Bouton>
                      )}
                      {/*  PÉRIMÈTRE PAR CYCLE (mig. 188-190).
                           ⚠️ Affiché SEULEMENT si l'école a au moins deux cycles :
                           proposer « un seul cycle » à une école qui n'en a qu'un
                           serait un réglage sans effet, donc un piège.
                           ⚠️ Et PAS pour le promoteur ni pour la RH : la base ne
                           les cloisonne jamais (c'est écrit dans `cycles_autorises`),
                           donc le sélecteur mentirait. */}
                      {complet && cycles.length > 1
                        && !(m.roles || []).some((r) => r === "admin_ecole" || r === "rh") && (() => {
                        const per = perimetres[m.id];
                        const courant = per?.mode === "cycles" && per.cycles?.length === 1
                          ? per.cycles[0] : "ecole";
                        //  ⚠️ QUI A POSÉ CE CLOISONNEMENT (mig. 197). Un périmètre
                        //  décide quels enfants une responsable voit : quand on le
                        //  trouve en place sans savoir d'où il vient, on n'ose ni le
                        //  garder ni le retirer. C'est arrivé le 10/10 sur Tut'Tank,
                        //  et la question est restée sans réponse. Les lignes
                        //  antérieures à la traçabilité le disent au lieu de
                        //  prétendre un auteur.
                        const origine = per?.mode === "cycles"
                          ? (per.pose_par_email
                              ? `Cloisonnement posé par ${per.pose_par_email}.`
                              : "Cloisonnement d'origine inconnue (posé avant la traçabilité).")
                          : undefined;
                        return (
                          <select value={courant}
                            onChange={(e) => reglerPerimetre(m, e.target.value)}
                            title={origine}
                            className="rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-xs text-navy-900 outline-none focus:border-or-500"
                            aria-label={origine
                              ? `Périmètre de ${m.prenom} ${m.nom}. ${origine}`
                              : `Périmètre de ${m.prenom} ${m.nom}`}>
                            <option value="ecole">Toute l'école</option>
                            {cycles.map((c) => (
                              <option key={c.id} value={c.id}>{c.libelle} seulement</option>
                            ))}
                          </select>
                        );
                      })()}
                      {m.actif === false ? (
                        <Bouton variante="fantome" className="!py-1.5 text-xs" onClick={() => suspendre(m, false)}>Réactiver</Bouton>
                      ) : (
                        <Bouton variante="fantome" className="!py-1.5 text-xs text-rose-600" onClick={() => suspendre(m, true)}>Suspendre</Bouton>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </Carte>
        )}

        {invitations.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-navy-900/70">
              Invitations en attente ({invitations.length})
            </h2>
            <Carte className="divide-y divide-navy-900/5">
              {invitations.map((inv) => {
                const gerable = complet || invitables.includes(inv.role);
                return (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-or-500/10 px-2 py-0.5 text-xs font-medium text-navy-800">
                          {LIBELLES_ROLES[inv.role] || inv.role}
                        </span>
                        <span className="font-mono text-sm font-bold tracking-widest text-or-600">{inv.code}</span>
                        {inv.email
                          ? <span className="text-xs text-navy-900/60">🔒 {inv.email}</span>
                          : <span className="text-xs text-navy-900/40">ouverte</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-navy-900/40">
                        créée le {dateCourte(inv.created_at)}{inv.cree_par_nom ? ` · par ${inv.cree_par_nom}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Bouton variante="fantome" className="!py-1.5 text-xs" onClick={() => copierLien(inv.code)}>Copier le lien</Bouton>
                      {gerable && (
                        <Bouton variante="fantome" className="!py-1.5 text-xs text-rose-600" onClick={() => annuler(inv)}>Annuler</Bouton>
                      )}
                    </div>
                  </div>
                );
              })}
            </Carte>
          </div>
        )}
      </div>

      {regle && (
        <ModaleAcces membre={regle} ecole={ecole}
          onFermer={() => setRegle(null)}
          onFait={async () => { setRegle(null); await charger(); }} />
      )}

      <ModaleInvitation
        ouvert={modale}
        onFermer={() => { setModale(false); charger(); }}
        rolesPossibles={invitables}
        ecole={ecole}
      />
    </>
  );
}

function ModaleInvitation({ ouvert, onFermer, rolesPossibles, ecole }) {
  const [role, setRole] = useState(rolesPossibles[0] || "");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (ouvert) { setRole(rolesPossibles[0] || ""); setEmail(""); setCode(""); setErreur(""); setCopie(false); }
  }, [ouvert]); // eslint-disable-line

  const lien = code ? lienInvitation(code) : "";
  const verrou = code && email.trim(); // invitation verrouillée sur l'email
  const message = code
    ? `Bonjour, vous êtes invité(e) à rejoindre ${ecole?.nom || "notre établissement"} sur GesSchool en tant que ${LIBELLES_ROLES[role] || role}. `
      + `Ouvrez ce lien puis saisissez le code ${code} : ${lien}`
      + (verrou ? ` (Créez votre compte avec l'adresse ${email.trim()}.)` : "")
    : "";

  async function generer(e) {
    e.preventDefault();
    setErreur(""); setEnCours(true);
    try {
      const c = await inviterMembre(role, email);
      setCode(c);
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  }

  const copier = async () => {
    try { await navigator.clipboard.writeText(message); setCopie(true); setTimeout(() => setCopie(false), 2000); } catch { /* ignore */ }
  };

  return (
    <Modale ouvert={ouvert} onFermer={onFermer} titre="Inviter un membre">
      {!code ? (
        <form onSubmit={generer} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Rôle à attribuer</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
              {rolesPossibles.map((r) => <option key={r} value={r}>{LIBELLES_ROLES[r] || r}</option>)}
            </select>
          </label>
          <div>
            <Champ label="Email (optionnel)" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="personne@exemple.com" />
            <p className="mt-1.5 text-xs text-navy-900/50">
              🔒 Si vous renseignez un email, l'invitation sera <strong>verrouillée</strong> sur cette adresse
              (la personne devra créer son compte avec). Laissez vide pour un code utilisable par tout destinataire.
            </p>
          </div>
          <Alerte ton="erreur">{erreur}</Alerte>
          <Bouton type="submit" className="w-full" disabled={enCours || !role}>
            {enCours ? "Génération…" : "Générer le code d'invitation"}
          </Bouton>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-or-500/30 bg-or-500/5 p-4 text-center">
            <p className="text-xs text-navy-900/50">Code d'invitation ({LIBELLES_ROLES[role] || role})</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-or-600">{code}</p>
            {verrou && (
              <p className="mt-2 text-xs text-navy-900/60">🔒 Verrouillé sur <strong>{email.trim()}</strong></p>
            )}
          </div>
          <p className="text-xs text-navy-900/60">
            La personne crée son compte sur GesSchool puis saisit ce code (ou ouvre le lien) pour rejoindre l'établissement.
          </p>
          <div className="break-all rounded-lg bg-creme px-3 py-2 text-xs text-navy-900/70">{lien}</div>
          <div className="grid grid-cols-3 gap-2">
            <Bouton variante="fantome" className="text-xs" onClick={copier}>{copie ? "Copié ✓" : "Copier"}</Bouton>
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"
              className="grid place-items-center rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-xs font-semibold text-navy-900 hover:bg-creme">WhatsApp</a>
            <a href={`mailto:${email || ""}?subject=${encodeURIComponent("Invitation GesSchool")}&body=${encodeURIComponent(message)}`}
              className="grid place-items-center rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-xs font-semibold text-navy-900 hover:bg-creme">Email</a>
          </div>
          <Bouton variante="or" className="w-full" onClick={onFermer}>Terminé</Bouton>
        </div>
      )}
    </Modale>
  );
}

// ---------------------------------------------------------------------
//  L'arbre à cocher d'un membre
// ---------------------------------------------------------------------
//
//  🔴 CE QUE CET ÉCRAN RÈGLE, ET POURQUOI IL N'EXISTAIT PAS AVANT. On
//  pouvait accorder un MODÈLE entier — « Comptable / Gestion », « Responsable
//  RH » — mais pas retirer une case. Besoin réel : les deux responsables de
//  l'école ne doivent pas voir la **Comptabilité**, alors que la responsable
//  **RH & Paie** doit la voir. Avec des modèles seuls, c'est impossible.
//
//  ⚠️ ET CE N'EST UTILISABLE QUE DEPUIS LES MIGRATIONS 175→200. Avant elles,
//  les droits réels tenaient aux RÔLES : décocher une case aurait masqué
//  l'écran pendant que la base continuait d'autoriser. Mesuré : avant la
//  migration 200, décocher « Comptabilité » laissait la responsable lire les
//  102 comptes du plan comptable. Un réglage qui a l'air de marcher et qui ne
//  protège rien est pire que pas de réglage.
function ModaleAcces({ membre, ecole, onFermer, onFait }) {
  const toast = useToast();
  const [coche, setCoche] = useState(null);
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);

  //  L'arbre vient du MENU (`ESPACES`), pas d'une liste retapée ici : un écran
  //  ajouté demain apparaîtra tout seul, et aucune case ne pourra désigner une
  //  autorisation qui n'existe pas.
  const arbre = arbreDesCases(ecole);
  const toutesDeLArbre = boitesDeLArbre(arbre);

  useEffect(() => {
    let vivant = true;
    getAccesDuMembre(membre.id)
      .then((l) => { if (vivant) setCoche(new Set(l)); })
      .catch((e) => { if (vivant) setErreur(e.message); });
    return () => { vivant = false; };
  }, [membre.id]);

  function basculer(id) {
    setCoche((s) => {
      const n = new Set(s);
      //  ⚠️ On bascule LA BOÎTE, pas « la boîte dans cet espace » : une clé
      //  transverse (Membres, Paramètres) apparaît dans plusieurs espaces et
      //  n'accorde qu'une seule autorisation. Sans cela, l'écran afficherait
      //  deux états pour une même case.
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function basculerEspace(espace, tout) {
    const ids = espace.groupes.flatMap((g) => g.cases.map((c) => c.id));
    setCoche((s) => {
      const n = new Set(s);
      for (const id of ids) { if (tout) n.add(id); else n.delete(id); }
      return n;
    });
  }

  async function enregistrer() {
    setErreur("");
    setBusy(true);
    try {
      const n = await definirAcces(membre.id, [...coche]);
      toast.succes(`${membre.prenom} a maintenant ${n} accès.`);
      await onFait();
    } catch (e) { setErreur(e.message); toast.erreur(e.message); }
    finally { setBusy(false); }
  }

  const n = coche ? coche.size : 0;

  return (
    <Modale ouvert onFermer={onFermer}
      titre={`Accès de ${membre.prenom} ${membre.nom}`}>
      <div className="space-y-4">
        <Alerte ton="erreur">{erreur}</Alerte>
        <p className="text-sm text-navy-900/60">
          Cochez ce à quoi cette personne a droit. <b>{n}</b> accès coché{n > 1 ? "s" : ""}.
        </p>

        {coche === null ? <SkeletonListe lignes={4} /> : (
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {arbre.map((e) => {
              const ids = e.groupes.flatMap((g) => g.cases.map((c) => c.id));
              const combien = ids.filter((id) => coche.has(id)).length;
              return (
                <div key={e.espace} className="rounded-xl border border-navy-900/10 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-display text-sm font-bold text-navy-900">
                      {e.icone} {e.label}
                      <span className="ml-2 text-xs font-normal text-navy-900/45">
                        {combien}/{ids.length}
                      </span>
                    </p>
                    {/*  Tout cocher / tout décocher un espace : sans cela, régler
                        un enseignant demanderait une trentaine de clics. */}
                    <button type="button" onClick={() => basculerEspace(e, combien < ids.length)}
                      className="text-xs text-navy-700 underline hover:text-or-600">
                      {combien < ids.length ? "tout cocher" : "tout décocher"}
                    </button>
                  </div>
                  {e.groupes.map((g, i) => (
                    <div key={g.groupe || i} className="mb-2">
                      {g.groupe && (
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-navy-900/40">
                          {g.groupe}
                        </p>
                      )}
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {g.cases.map((c) => (
                          <label key={c.id}
                            className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-creme/60">
                            <input type="checkbox" checked={coche.has(c.id)}
                              onChange={() => basculer(c.id)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-900/25 text-navy-900 focus:ring-or-500" />
                            <span>
                              {c.label}
                              {/*  Dire ce qu'une case FUSIONNÉE couvre vraiment :
                                  quatre cases regroupent onze écrans parce qu'ils
                                  lisent les mêmes tables. Le promoteur doit
                                  pouvoir le vérifier d'un œil. */}
                              {c.couvre && (
                                <span className="block text-xs text-navy-900/45">
                                  {c.couvre.join(" · ")}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {/*  ⚠️ LES POUVOIRS NE SONT PAS DES ÉCRANS, CE SONT DES ACTES, et ce
                sont eux qui distinguent la direction de l'enseignant : diffuser
                les bulletins, modifier une fiche élève, voir les impayés… Ils
                ont leur propre section parce que les confondre avec un écran
                accorderait des droits inégaux sous une même case — le défaut
                qui a rendu nécessaires les sept pouvoirs du chantier. */}
            <div className="rounded-xl border border-or-500/30 bg-or-500/5 p-3">
              <p className="mb-2 font-display text-sm font-bold text-navy-900">
                ⚡ Ce que cette personne peut FAIRE
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {POUVOIRS.map((p) => (
                  <label key={p.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/60">
                    <input type="checkbox" checked={coche.has(p.id)}
                      onChange={() => basculer(p.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-900/25 text-navy-900 focus:ring-or-500" />
                    <span>
                      {p.label}
                      {/*  L'aide de chaque pouvoir, affichée et pas masquée dans
                          une infobulle : « Arrêter et publier les bulletins » ne
                          dit pas à lui seul que cela couvre la signature du
                          procès-verbal du conseil. */}
                      {p.aide && (
                        <span className="block text-xs text-navy-900/45">{p.aide}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Bouton type="button" variante="fantome" onClick={onFermer}>Annuler</Bouton>
          <Bouton onClick={enregistrer} disabled={busy || coche === null}>
            {busy ? "…" : "Enregistrer les accès"}
          </Bouton>
        </div>
      </div>
    </Modale>
  );
}
