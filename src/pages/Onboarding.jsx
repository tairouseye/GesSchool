import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { supabase } from "@/lib/supabase.js";
import { CYCLES, anneeParDefaut } from "@/lib/cycles.js";
import { PAYS, deviseDuPays } from "@/lib/pays.js";
import Cachet from "@/composants/Cachet.jsx";
import { Bouton, Champ, Carte, Alerte } from "@/composants/ui.jsx";

// Phase 0.4 — Assistant de création d'établissement (3 étapes).
// Au terme, appelle la fonction SECURITY DEFINER creer_ecole_et_admin.
export default function Onboarding() {
  const { utilisateur, deconnexion, rafraichirProfil } = useAuth();
  const navigate = useNavigate();
  const annee = anneeParDefaut();

  const [etape, setEtape] = useState(1);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Données du formulaire
  const [f, setF] = useState({
    nom: "", sigle: "", type_etablissement: "Privé",
    pays: "Sénégal", ville: "",
    couleur_primaire: "#0B1F3A", couleur_secondaire: "#C9A227",
    logoFile: null, cachetFile: null,
    cycles: [],
    prenom: "", nom_admin: "",
    annee_libelle: annee.libelle, annee_debut: annee.debut, annee_fin: annee.fin,
    decoupage: "trimestre",
  });
  const maj = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleCycle = (t) =>
    setF((s) => ({
      ...s,
      cycles: s.cycles.includes(t) ? s.cycles.filter((c) => c !== t) : [...s.cycles, t],
    }));

  // Upload optionnel d'un asset dans le bucket 'ecoles'
  async function televerser(file, suffixe) {
    if (!file) return null;
    const ext = file.name.split(".").pop();
    const chemin = `${utilisateur.id}/${suffixe}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("ecoles").upload(chemin, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from("ecoles").getPublicUrl(chemin).data.publicUrl;
  }

  async function finaliser() {
    setErreur("");
    setEnCours(true);
    try {
      const logo_url = await televerser(f.logoFile, "logo");
      const cachet_url = await televerser(f.cachetFile, "cachet");

      const { error } = await supabase.rpc("creer_ecole_et_admin", {
        p_nom: f.nom, p_sigle: f.sigle, p_type_etablissement: f.type_etablissement,
        p_cycles: f.cycles,
        p_couleur_primaire: f.couleur_primaire, p_couleur_secondaire: f.couleur_secondaire,
        p_logo_url: logo_url, p_cachet_url: cachet_url,
        p_prenom: f.prenom, p_nom_admin: f.nom_admin,
        p_annee_libelle: f.annee_libelle, p_annee_debut: f.annee_debut, p_annee_fin: f.annee_fin,
        p_decoupage: f.decoupage,
        p_pays: f.pays, p_ville: f.ville, p_devise: deviseDuPays(f.pays),
      });
      if (error) throw error;

      await rafraichirProfil();
      navigate("/", { replace: true });
    } catch (err) {
      setErreur(err.message || "Échec de la création de l'établissement.");
    } finally {
      setEnCours(false);
    }
  }

  // Validations par étape
  const etape1OK = f.nom.trim() && f.sigle.trim() && f.pays && f.ville.trim();
  const etape2OK = f.cycles.length > 0;
  const etape3OK = f.prenom.trim() && f.nom_admin.trim() && f.annee_libelle.trim();

  return (
    <div className="grid min-h-full place-items-center bg-navy-900 px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-5 flex flex-col items-center text-creme">
          <Cachet size={64} className="text-or-500" />
          <h1 className="mt-3 font-display text-2xl font-bold">Créer votre établissement</h1>
          <p className="text-sm text-creme/60">Étape {etape} sur 3</p>
        </div>

        {/* Progression */}
        <div className="mb-5 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-1.5 rounded-full ${n <= etape ? "bg-or-500" : "bg-creme/20"}`} />
          ))}
        </div>

        <Carte className="p-7">
          {/* ÉTAPE 1 — Identité */}
          {etape === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-navy-900">Identité de l'école</h2>
              <Champ label="Nom de l'établissement *" value={f.nom}
                     onChange={(e) => maj("nom", e.target.value)} placeholder="Institut Cheikh Anta Diop" />
              <div className="grid grid-cols-2 gap-4">
                <Champ label="Sigle *" value={f.sigle}
                       onChange={(e) => maj("sigle", e.target.value.toUpperCase())} placeholder="ICAD" />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Type</span>
                  <select value={f.type_etablissement} onChange={(e) => maj("type_etablissement", e.target.value)}
                          className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                    <option>Privé</option><option>Public</option><option>Confessionnel</option><option>Franco-arabe</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Pays *</span>
                  <select value={f.pays} onChange={(e) => maj("pays", e.target.value)}
                          className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-or-500">
                    {PAYS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <Champ label="Ville *" value={f.ville}
                       onChange={(e) => maj("ville", e.target.value)} placeholder="Dakar" />
              </div>
              <p className="-mt-2 text-xs text-navy-900/40">
                Pays et ville apparaissent sur les documents officiels (certificats, attestations, bulletins).
                Devise appliquée : <b>{deviseDuPays(f.pays)}</b> — modifiable ensuite dans Paramètres.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <FichierChamp label="Logo (optionnel)" onChange={(file) => maj("logoFile", file)} fichier={f.logoFile} />
                <FichierChamp label="Cachet (optionnel)" onChange={(file) => maj("cachetFile", file)} fichier={f.cachetFile} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <CouleurChamp label="Couleur primaire" value={f.couleur_primaire} onChange={(v) => maj("couleur_primaire", v)} />
                <CouleurChamp label="Couleur secondaire" value={f.couleur_secondaire} onChange={(v) => maj("couleur_secondaire", v)} />
              </div>
            </div>
          )}

          {/* ÉTAPE 2 — Cycles */}
          {etape === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-navy-900">Cycles ouverts</h2>
              <p className="text-sm text-navy-900/50">Sélectionnez les cycles présents dans votre établissement.</p>
              <div className="grid grid-cols-2 gap-3">
                {CYCLES.map((c) => {
                  const actif = f.cycles.includes(c.type);
                  return (
                    <button key={c.type} type="button" onClick={() => toggleCycle(c.type)}
                      className={`rounded-xl border p-4 text-left transition ${
                        actif ? "border-or-500 bg-or-500/10" : "border-navy-900/15 hover:border-navy-900/30"}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-navy-900">{c.libelle}</span>
                        <span className={`grid h-5 w-5 place-items-center rounded-full text-xs ${
                          actif ? "bg-or-500 text-navy-900" : "bg-navy-900/10 text-transparent"}`}>✓</span>
                      </div>
                      <p className="mt-1 text-xs text-navy-900/50">{c.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ÉTAPE 3 — Responsable & année */}
          {etape === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-navy-900">Responsable & année scolaire</h2>
              <div className="grid grid-cols-2 gap-4">
                <Champ label="Votre prénom *" value={f.prenom} onChange={(e) => maj("prenom", e.target.value)} />
                <Champ label="Votre nom *" value={f.nom_admin} onChange={(e) => maj("nom_admin", e.target.value)} />
              </div>
              <Champ label="Année scolaire *" value={f.annee_libelle} onChange={(e) => maj("annee_libelle", e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <Champ label="Début" type="date" value={f.annee_debut} onChange={(e) => maj("annee_debut", e.target.value)} />
                <Champ label="Fin" type="date" value={f.annee_fin} onChange={(e) => maj("annee_fin", e.target.value)} />
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-navy-900/70">Découpage</span>
                <div className="grid grid-cols-2 gap-2">
                  {[["trimestre", "Trimestres (3)"], ["semestre", "Semestres (2)"]].map(([v, lib]) => (
                    <button key={v} type="button" onClick={() => maj("decoupage", v)}
                      className={`rounded-xl border py-2.5 text-sm font-medium transition ${
                        f.decoupage === v ? "border-or-500 bg-or-500/10 text-navy-900" : "border-navy-900/15 text-navy-900/60"}`}>
                      {lib}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          )}

          <Alerte ton="erreur">{erreur}</Alerte>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            {etape > 1 ? (
              <Bouton variante="fantome" onClick={() => setEtape(etape - 1)}>← Précédent</Bouton>
            ) : <span />}

            {etape < 3 ? (
              <Bouton onClick={() => setEtape(etape + 1)}
                      disabled={(etape === 1 && !etape1OK) || (etape === 2 && !etape2OK)}>
                Continuer →
              </Bouton>
            ) : (
              <Bouton variante="or" onClick={finaliser} disabled={!etape3OK || enCours}>
                {enCours ? "Création…" : "Créer l'établissement"}
              </Bouton>
            )}
          </div>
        </Carte>

        <div className="mt-4 text-center">
          <button onClick={deconnexion} className="text-xs text-creme/40 hover:text-creme/70">
            {utilisateur?.email} · Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}

function FichierChamp({ label, onChange, fichier }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-900/70">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-navy-900/25 px-3 py-2.5">
        <input type="file" accept="image/*" onChange={(e) => onChange(e.target.files?.[0] ?? null)}
               className="block w-full text-xs text-navy-900/60 file:mr-2 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-creme" />
      </div>
      {fichier && <span className="mt-1 block truncate text-xs text-emerald-600">✓ {fichier.name}</span>}
    </label>
  );
}

function CouleurChamp({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-900/70">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-navy-900/15 px-3 py-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
               className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" />
        <span className="font-mono text-xs text-navy-900/60">{value}</span>
      </div>
    </label>
  );
}
