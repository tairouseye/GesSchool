import { Link } from "react-router-dom";
import Logo from "@/composants/Logo.jsx";
import { GESPRO, lienWhatsAppGesPro, copyrightGesPro } from "@/lib/gespro.js";

// Page « À propos » — vitrine du concepteur (GesPro), publique (accessible
// depuis la signature de pied de page). Élégante, non intrusive, configurable
// via lib/gespro.js. Sert aussi de point d'entrée marketing (solutions GesPro).
export default function APropos() {
  const c = GESPRO.contacts;
  return (
    <div className="min-h-dscreen bg-gradient-to-b from-navy-900 to-navy-800 px-4 py-10 text-creme">
      <div className="mx-auto w-full max-w-3xl">
        <Link to="/connexion" className="text-sm text-creme/60 hover:text-or-500">← Retour</Link>

        {/* En-tête concepteur */}
        <header className="mt-6 flex flex-col items-center text-center">
          <Logo size={72} fond className="rounded-2xl shadow-lg" />
          <h1 className="mt-4 font-display text-3xl font-bold">{GESPRO.nom}</h1>
          <p className="mt-1 max-w-md text-creme/60">{GESPRO.slogan}</p>
        </header>

        {/* À propos de cette solution */}
        <section className="mt-10 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <h2 className="font-display text-lg font-semibold text-or-500">À propos de cette solution</h2>
          <p className="mt-2 text-sm leading-relaxed text-creme/75">
            <b className="text-creme">GesSchool</b> est une plateforme de gestion scolaire conçue et développée
            par <b className="text-creme">{GESPRO.nom}</b>, spécialiste des solutions logicielles intelligentes
            pour la gestion des entreprises et des établissements. Notre mission : des outils simples, fiables
            et modernes, accessibles même sur un simple téléphone.
          </p>
        </section>

        {/* Contact */}
        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <a href={c.site} target="_blank" rel="noreferrer" className="rounded-xl bg-white/5 p-4 text-center ring-1 ring-white/10 transition hover:bg-white/10">
            <p className="text-lg">🌐</p><p className="mt-1 text-xs font-medium text-creme/80">Site web</p>
            <p className="truncate text-[11px] text-creme/45">{c.site.replace(/^https?:\/\//, "")}</p>
          </a>
          <a href={`mailto:${c.email}`} className="rounded-xl bg-white/5 p-4 text-center ring-1 ring-white/10 transition hover:bg-white/10">
            <p className="text-lg">✉️</p><p className="mt-1 text-xs font-medium text-creme/80">E-mail</p>
            <p className="truncate text-[11px] text-creme/45">{c.email}</p>
          </a>
          <a href={lienWhatsAppGesPro()} target="_blank" rel="noreferrer" className="rounded-xl bg-white/5 p-4 text-center ring-1 ring-white/10 transition hover:bg-white/10">
            <p className="text-lg">💬</p><p className="mt-1 text-xs font-medium text-creme/80">WhatsApp</p>
            <p className="truncate text-[11px] text-creme/45">{c.telephone}</p>
          </a>
        </section>

        {/* Découvrez les solutions GesPro */}
        {GESPRO.solutions?.length > 0 && (
          <section className="mt-10">
            <h2 className="text-center font-display text-lg font-semibold text-creme">Découvrez les solutions {GESPRO.nom}</h2>
            <p className="mt-1 text-center text-sm text-creme/50">D'autres outils pour transformer votre gestion.</p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {GESPRO.solutions.map((s) => (
                <div key={s.nom} className="flex flex-col rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-creme">{s.nom}</h3>
                    <span className="rounded-full bg-or-500/15 px-2.5 py-0.5 text-[11px] font-medium text-or-500">{s.secteur}</span>
                  </div>
                  <p className="mt-2 flex-1 text-sm text-creme/60">{s.desc}</p>
                  <a href={s.url} target="_blank" rel="noreferrer"
                    className="mt-4 inline-flex w-max items-center gap-1 rounded-lg bg-or-500 px-3.5 py-1.5 text-sm font-semibold text-navy-900 transition hover:bg-or-400">
                    Découvrir →
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-12 border-t border-white/10 pt-5 text-center text-[11px] text-creme/40">
          <p>{copyrightGesPro()}</p>
          <p className="mt-1 font-mono text-creme/30">GesSchool v{__APP_VERSION__} · {__BUILD_DATE__}</p>
        </footer>
      </div>
    </div>
  );
}
