import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Bouton, Champ, ChampMotDePasse, Alerte } from "@/composants/ui.jsx";
import { ECOLES_REFERENCES } from "@/lib/references.js";
import GesProSignature from "@/composants/GesProSignature.jsx";
import { GESPRO } from "@/lib/gespro.js";
import Logo from "@/composants/Logo.jsx";
import { Icone } from "@/composants/Icones.jsx";
import { fondDuMois } from "@/lib/fondsConnexion.js";
import { messageErreur } from "@/lib/erreurs.js";
import { biometrieSupportee, connecterBiometrie, messageBiometrie } from "@/lib/biometrie.js";

// Page Connexion / Inscription (onglets).
export default function Connexion() {
  const { connexion, inscription } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("connexion"); // 'connexion' | 'inscription'
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [fond] = useState(() => fondDuMois());
  const [fondPret, setFondPret] = useState(false);

  // Empreinte ou visage (passkey) : pas d'e-mail à taper, le téléphone
  // retrouve le compte. Une annulation n'est pas une erreur à afficher.
  async function connexionBio() {
    setErreur(""); setInfo(""); setEnCours(true);
    try {
      await connecterBiometrie();
      navigate("/", { replace: true });
    } catch (err) {
      const m = messageBiometrie(err);
      if (m !== "Opération annulée.") setErreur(m);
    } finally {
      setEnCours(false);
    }
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    setInfo("");
    setEnCours(true);
    try {
      if (mode === "connexion") {
        const { error } = await connexion(email, mdp);
        if (error) throw error;
        navigate("/", { replace: true });
      } else {
        const { data, error } = await inscription(email, mdp);
        if (error) throw error;
        // Selon la config Supabase, une confirmation e-mail peut être requise.
        if (data.session) navigate("/", { replace: true });
        else setInfo("Compte créé. Vérifiez votre e-mail pour confirmer, puis connectez-vous.");
      }
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="relative min-h-dscreen overflow-hidden bg-navy-900">
      {/* Le fond du mois : la photo apparaît en fondu une fois chargée ; en
          attendant (ou hors ligne), le navy de la charte. Le voile navy
          garde le logo et les textes crème lisibles sur n'importe quelle
          photo. */}
      <img src={fond.image} alt="" aria-hidden="true" onLoad={() => setFondPret(true)}
        style={{ objectPosition: fond.position }}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${fondPret ? "opacity-100" : "opacity-0"}`} />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-navy-900/70 via-navy-900/15 to-navy-900/85" />

      <div className="relative grid min-h-dscreen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-creme">
          <Logo size={80} fond className="rounded-full shadow-lg" />
          <h1 className="mt-3 font-display text-2xl font-bold">
            Ges<span className="text-or-500">School</span>
          </h1>
          <p className="text-sm text-creme/60">L'école connectée, la gestion simplifiée</p>
          <p className="mt-1.5 text-xs font-medium text-creme/45">{GESPRO.signature}</p>
          <p className="mt-2 font-mono text-[11px] text-creme/40">v{__APP_VERSION__} · {__BUILD_DATE__}</p>
        </div>

        <div className="rounded-2xl bg-white/90 p-7 shadow-xl backdrop-blur-md">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-creme p-1">
            {["connexion", "inscription"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErreur(""); setInfo(""); }}
                className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
                  mode === m ? "bg-navy-900 text-creme" : "text-navy-900/60 hover:text-navy-900"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={soumettre} className="space-y-4">
            <Champ
              label="E-mail" type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@ecole.sn"
            />
            <ChampMotDePasse
              label="Mot de passe" required minLength={6}
              autoComplete={mode === "connexion" ? "current-password" : "new-password"}
              value={mdp} onChange={(e) => setMdp(e.target.value)}
              placeholder="••••••••"
            />

            <Alerte ton="erreur">{erreur}</Alerte>
            <Alerte ton="succes">{info}</Alerte>

            <Bouton type="submit" className="w-full" disabled={enCours}>
              {enCours ? "Patientez…" : mode === "connexion" ? "Se connecter" : "Créer le compte"}
            </Bouton>
          </form>

          {mode === "connexion" && (
            <div className="mt-4 text-center">
              <Link to="/mot-de-passe-oublie" className="text-sm text-navy-700 hover:text-or-500">
                Mot de passe oublié ?
              </Link>
            </div>
          )}

          {mode === "connexion" && biometrieSupportee() && (
            <>
              <div className="my-4 flex items-center gap-3 text-xs text-navy-900/40">
                <span className="h-px flex-1 bg-navy-900/10" />ou<span className="h-px flex-1 bg-navy-900/10" />
              </div>
              {/* Le cadre de visée seul, centré, comme dans les applis
                  bancaires : un geste que l'on reconnaît sans le lire. */}
              <button type="button" onClick={connexionBio} disabled={enCours}
                aria-label="Se connecter avec l'empreinte ou le visage"
                className="mx-auto flex w-fit flex-col items-center gap-1.5 rounded-2xl px-4 py-2 text-navy-900 hover:bg-navy-900/5 disabled:opacity-60">
                <Icone name="biometrie" className="h-12 w-12" />
                <span className="text-xs font-medium text-navy-900/70">Empreinte ou visage</span>
              </button>
            </>
          )}
        </div>

        {/* L'encart du mois : un message éducatif, plus tard un partenaire. */}
        <div className="mt-4 rounded-2xl bg-creme/95 px-4 py-3 shadow-lg">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-or-600">{fond.type} · {fond.theme}</p>
          <p className="mt-0.5 text-sm text-navy-900/80">{fond.message}</p>
        </div>

        {ECOLES_REFERENCES.length > 0 && (
          <div className="mt-8">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-creme/40">
              Ils nous font confiance
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {ECOLES_REFERENCES.map((e) => (
                <div key={e.nom} className="flex items-center gap-2 rounded-xl bg-white/95 px-3.5 py-2 shadow-sm ring-1 ring-white/10">
                  <img src={e.logo} alt={e.nom} className="h-9 w-9 shrink-0 object-contain" />
                  <span className="text-sm font-semibold text-navy-900">{e.nom}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <GesProSignature ton="sombre" avecContacts avecSlogan={false} avecVersion={false} className="mt-6" />
      </div>
      </div>
    </div>
  );
}
