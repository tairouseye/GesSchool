import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Champ, Carte, Alerte, Modale } from "@/composants/ui.jsx";
import { LIBELLES_ROLES, rolesInvitables, estRoleComplet } from "@/lib/permissions.js";
import { getMembres, inviterMembre, revoquerRole, suspendreMembre, lienInvitation, getInvitations, annulerInvitation } from "@/lib/membres.js";
import { EtatVide } from "@/composants/ui.jsx";
import { useConfirm, useToast } from "@/composants/Feedback.jsx";

export default function Membres() {
  const { roles, ecole, profil } = useAuth();
  const confirmer = useConfirm();
  const toast = useToast();
  const invitables = rolesInvitables(roles); // rôles que je peux déléguer
  const complet = estRoleComplet(roles);

  const [membres, setMembres] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [erreur, setErreur] = useState("");
  const [modale, setModale] = useState(false);

  const charger = useCallback(async () => {
    setErreur("");
    try {
      const [m, inv] = await Promise.all([getMembres(), getInvitations()]);
      setMembres(m);
      setInvitations(inv);
    } catch (e) { setErreur(e.message); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

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

        {membres.length === 0 ? (
          <EtatVide icone="👥" titre="Aucun membre"
            action={invitables.length > 0 ? <Bouton onClick={() => setModale(true)}>+ Inviter un membre</Bouton> : null}>
            Invitez les responsables et le personnel de votre établissement pour qu'ils accèdent à leur espace.
          </EtatVide>
        ) : (
        <Carte className="divide-y divide-navy-900/5">
          {(
            membres.map((m) => {
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
                    <div className="flex shrink-0 gap-2">
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
