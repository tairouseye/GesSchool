import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { Bouton, Alerte } from "@/composants/ui.jsx";
import { ECOLES_REFERENCES } from "@/lib/references.js";
import GesProSignature from "@/composants/GesProSignature.jsx";
import { GESPRO } from "@/lib/gespro.js";
import Logo from "@/composants/Logo.jsx";
import { Icone } from "@/composants/Icones.jsx";
import { fondDuMois } from "@/lib/fondsConnexion.js";
import { getEncartsConnexion } from "@/lib/encarts.js";
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

        {/* Téléphone : carte en verre, la photo passe à travers (comme les
            applis bancaires). Ordinateur (sm:) : la carte blanche. */}
        <div className="rounded-2xl border border-white/25 bg-navy-900/25 p-6 shadow-xl backdrop-blur-[3px] sm:border-0 sm:bg-white/90 sm:p-7 sm:backdrop-blur-md">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-white/15 p-1 sm:bg-creme">
            {["connexion", "inscription"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErreur(""); setInfo(""); }}
                className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
                  mode === m ? "bg-navy-900 text-creme" : "text-creme/85 hover:text-creme sm:text-navy-900/60 sm:hover:text-navy-900"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={soumettre} className="space-y-4">
            <ChampConnexion
              label="E-mail" type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@ecole.sn"
            />
            <ChampConnexion
              motDePasse label="Mot de passe" required minLength={6}
              autoComplete={mode === "connexion" ? "current-password" : "new-password"}
              value={mdp} onChange={(e) => setMdp(e.target.value)}
              placeholder="••••••••"
            />

            <Alerte ton="erreur">{erreur}</Alerte>
            <Alerte ton="succes">{info}</Alerte>

            <Bouton type="submit" variante="or" disabled={enCours}
              className="w-full sm:bg-navy-900 sm:text-creme sm:hover:bg-navy-800">
              {enCours ? "Patientez…" : mode === "connexion" ? "Se connecter" : "Créer le compte"}
            </Bouton>
          </form>

          {mode === "connexion" && (
            <div className="mt-4 text-center">
              <Link to="/mot-de-passe-oublie" className="text-sm text-creme hover:text-or-400 sm:text-navy-700 sm:hover:text-or-500">
                Mot de passe oublié ?
              </Link>
            </div>
          )}

          {mode === "connexion" && biometrieSupportee() && (
            <>
              <div className="my-4 flex items-center gap-3 text-xs text-creme/75 sm:text-navy-900/40">
                <span className="h-px flex-1 bg-white/30 sm:bg-navy-900/10" />ou<span className="h-px flex-1 bg-white/30 sm:bg-navy-900/10" />
              </div>
              {/* Le cadre de visée seul, centré, comme dans les applis
                  bancaires : un geste que l'on reconnaît sans le lire. */}
              <button type="button" onClick={connexionBio} disabled={enCours}
                aria-label="Se connecter avec l'empreinte ou le visage"
                className="mx-auto flex w-fit flex-col items-center gap-1.5 rounded-2xl px-4 py-2 text-white hover:bg-white/10 disabled:opacity-60 sm:text-navy-900 sm:hover:bg-navy-900/5">
                <Icone name="biometrie" className="h-12 w-12" />
                <span className="text-xs font-medium text-creme/85 sm:text-navy-900/70">Empreinte ou visage</span>
              </button>
            </>
          )}
        </div>

        <EncartConnexion fond={fond} />

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

// L'encart sous la carte : le conseil du mois, en alternance avec les
// partenaires de l'éducation en cours (migration 215, saisis dans la console
// super-admin). Sans partenaire, le conseil reste seul et rien ne défile.
const DUREE_ENCART = 7000;

function EncartConnexion({ fond }) {
  const [partenaires, setPartenaires] = useState([]);
  const [tour, setTour] = useState(0);

  useEffect(() => {
    let vivant = true;
    getEncartsConnexion().then((p) => { if (vivant) setPartenaires(p); });
    return () => { vivant = false; };
  }, []);

  const total = 1 + partenaires.length;
  useEffect(() => {
    if (total < 2) return undefined;
    //  Pas de défilement automatique pour qui l'a désactivé dans son système.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const t = setInterval(() => setTour((n) => n + 1), DUREE_ENCART);
    return () => clearInterval(t);
  }, [total]);

  const i = tour % total;
  const p = i === 0 ? null : partenaires[i - 1];

  return (
    <div className="mt-4">
      <div key={i} className="min-h-[4.5rem] animate-[fondu_.4s_ease-out] rounded-2xl bg-creme/95 px-4 py-3 shadow-lg">
        {p ? (
          <div className="flex items-center gap-3">
            {p.logo_url && (
              <img src={p.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-navy-900/10 bg-white object-contain p-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-or-600">Partenaire · {p.partenaire}</p>
              <p className="mt-0.5 text-sm text-navy-900/80">
                {p.message}
                {p.lien && (
                  <> <a href={p.lien} target="_blank" rel="noopener noreferrer sponsored"
                    className="whitespace-nowrap font-semibold text-navy-700 hover:text-or-600">En savoir plus ›</a></>
                )}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-or-600">{fond.type} · {fond.theme}</p>
            <p className="mt-0.5 text-sm text-navy-900/80">{fond.message}</p>
          </>
        )}
      </div>
      {total > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: total }, (_, k) => (
            <button key={k} type="button" onClick={() => setTour(k)} aria-label={`Message ${k + 1} sur ${total}`}
              className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-or-500" : "w-1.5 bg-creme/50"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// Champ de la page de connexion. Téléphone : souligné blanc sur la photo,
// sans fond (16 px pour que l'iPhone ne zoome pas) ; ordinateur : le champ
// habituel de l'appli. `champ-verre` neutralise le fond jaune de
// l'autoremplissage du navigateur (index.css).
function ChampConnexion({ label, motDePasse = false, type, ...props }) {
  const [voir, setVoir] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-creme/85 sm:mb-1.5 sm:text-navy-900/70">{label}</span>
      <div className="relative">
        <input
          type={motDePasse ? (voir ? "text" : "password") : type}
          className={`champ-verre w-full border-0 border-b border-white/60 bg-transparent px-1 py-2.5 text-base text-white outline-none transition placeholder:text-white/55 focus:border-or-400 sm:rounded-xl sm:border sm:border-navy-900/15 sm:bg-white sm:px-4 sm:text-sm sm:text-navy-900 sm:placeholder:text-navy-900/40 sm:focus:border-or-500 sm:focus:ring-2 sm:focus:ring-or-500/20 ${motDePasse ? "pr-11" : ""}`}
          {...props}
        />
        {motDePasse && (
          <button type="button" onClick={() => setVoir((v) => !v)}
            aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            title={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/75 transition hover:text-white sm:right-2 sm:text-navy-900/40 sm:hover:bg-navy-900/5 sm:hover:text-navy-900/70">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {voir ? (
                <><path d="M3 3l18 18" /><path d="M10.6 10.6a3 3 0 004.2 4.2" /><path d="M9.9 5.1A9.5 9.5 0 0112 5c6.5 0 10 7 10 7a17.2 17.2 0 01-3.3 4.1M6.6 6.6A17.3 17.3 0 002 12s3.5 7 10 7a9.6 9.6 0 004.1-.9" /></>
              ) : (
                <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>
              )}
            </svg>
          </button>
        )}
      </div>
    </label>
  );
}
