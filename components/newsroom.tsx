"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Facebook, Heart, Instagram, Mail, Menu, Search, Share2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type Article = {
  id: string;
  title: string;
  slug: string;
  snippet: string;
  image_url: string | null;
  category: string;
  region: string | null;
  likes_count: number;
  published_at: string | null;
  created_at: string;
};

const categories = ["All", "Politics", "Sports", "Business", "Entertainment", "General"];
const fallbackImage = "/hero.jpg";

function formatDate(value: string | null) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function Logo() {
  return (
    <Link href="/" aria-label="Next Level Media home" className="flex shrink-0 items-center gap-3">
      <Image src="/hero.jpg" alt="Next Level Media" width={46} height={46} priority className="h-11 w-11 rounded-xl object-cover" />
      <span className="font-[var(--font-space)] text-base font-bold leading-none tracking-tight sm:text-lg">
        NEXT LEVEL<span className="mt-1 block text-[10px] font-semibold tracking-[.42em] text-blue-400">MEDIA</span>
      </span>
    </Link>
  );
}

export function Newsroom({ initialArticles }: { initialArticles: Article[] }) {
  const [articles, setArticles] = useState(initialArticles);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [liked, setLiked] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nlm-liked");
      if (saved) setLiked(JSON.parse(saved) as string[]);
    } catch (error) {
      console.error("Could not read saved article likes", error);
    }
  }, []);

  useEffect(() => {
    if (!query.trim() && category === "All") {
      setArticles(initialArticles);
      setSearchError("");
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      const params = new URLSearchParams({ q: query.trim(), category });
      try {
        const response = await fetch(`/api/search?${params}`, { signal: controller.signal });
        const result = await response.json() as { articles?: Article[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Search could not be completed.");
        setArticles(result.articles ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Article search request failed", error);
        setSearchError(error instanceof Error ? error.message : "Search could not be completed.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, query.trim() ? 250 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, initialArticles, query]);

  const like = async (article: Article) => {
    if (liked.includes(article.id)) return;
    const next = [...liked, article.id];
    setLiked(next);
    try {
      localStorage.setItem("nlm-liked", JSON.stringify(next));
    } catch (error) {
      console.error("Could not save article likes", error);
    }
    setArticles((items) => items.map((item) => item.id === article.id
      ? { ...item, likes_count: item.likes_count + 1 }
      : item));
    const { error } = await supabase.from("articles").update({ likes_count: article.likes_count + 1 }).eq("id", article.id);
    if (error) {
      console.error("Could not update article likes", error.message);
      setNotice("Your like could not be saved.");
    }
  };

  const share = async (article: Article) => {
    const url = `${window.location.origin}/news/${article.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: article.title, text: article.snippet, url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice("Article link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Could not share article", error);
      setNotice("The article link could not be shared.");
    }
  };

  const sendTip = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = `News tip from ${String(data.get("name") ?? "")}`;
    const body = `${String(data.get("message") ?? "")}\n\nReply to: ${String(data.get("email") ?? "")}`;
    window.location.href = `mailto:nextlevelmedia473@outlook.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const featured = articles[0];
  const latest = articles.slice(1);

  return (
    <main id="top" className="min-h-screen overflow-hidden">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080e19]/95 shadow-lg shadow-black/10 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-slate-300 xl:flex">
            <a className="transition hover:text-white" href="#latest">Latest</a>
            <a className="transition hover:text-white" href="#categories">Categories</a>
            <a className="transition hover:text-white" href="#about">About</a>
          </nav>
          <form onSubmit={(event) => event.preventDefault()} role="search" className="ml-auto hidden min-w-48 max-w-md flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 focus-within:border-blue-400/70 md:flex">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              aria-label="Search all stories and categories"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search all news..."
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>}
          </form>
          <Link href="/admin" className="hidden rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-400 hover:text-white sm:inline-flex">Publisher</Link>
          <button type="button" aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen(!mobileOpen)} className="ml-auto rounded-lg p-2 text-slate-200 md:ml-0 xl:hidden">
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-white/10 px-4 py-4 xl:hidden">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3">
              <Search aria-hidden="true" className="h-4 w-4 text-slate-500" />
              <input aria-label="Search all stories and categories" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all news..." className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-500" />
            </label>
            <nav className="mt-3 flex gap-3 text-sm text-slate-300">
              <a className="rounded-lg px-3 py-2 hover:bg-white/5" href="#latest" onClick={() => setMobileOpen(false)}>Latest</a>
              <a className="rounded-lg px-3 py-2 hover:bg-white/5" href="#categories" onClick={() => setMobileOpen(false)}>Categories</a>
              <a className="rounded-lg px-3 py-2 hover:bg-white/5" href="#about" onClick={() => setMobileOpen(false)}>About</a>
            </nav>
          </div>
        )}
      </header>

      <section className="blue-grid relative border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 sm:pb-16 sm:pt-20 lg:px-8">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.17em] text-blue-300">Independent Nigerian journalism</p>
          <h1 className="max-w-4xl text-balance text-5xl font-bold leading-[.99] text-white sm:text-7xl">News that moves<br /><span className="text-blue-500">you forward.</span></h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">Independent reporting from Oyo, Osun, Lagos, Ekiti and the national stage — sharp, useful and close to home.</p>
          <div className="mt-8 flex flex-wrap gap-3 text-xs font-medium text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5">Local voices</span>
            <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5">National perspective</span>
            <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5">Stories that matter</span>
          </div>
        </div>
      </section>

      <section id="latest" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-blue-400">The newsroom</p>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">{query || category !== "All" ? "Explore stories" : "Top stories today"}</h2>
          </div>
          <a href="#contact" className="hidden items-center gap-1 text-sm font-semibold text-blue-400 transition hover:text-blue-300 sm:flex">Send a news tip <ArrowRight className="h-4 w-4" /></a>
        </div>
        <div id="categories" className="mb-8 flex gap-2 overflow-x-auto pb-2" aria-label="Filter stories by category">
          {categories.map((item) => (
            <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${category === item ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40" : "border border-white/10 bg-white/[.03] text-slate-400 hover:text-white"}`}>{item}</button>
          ))}
        </div>
        {searching && <p role="status" className="mb-4 text-sm text-slate-400">Searching all published stories…</p>}
        {searchError && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{searchError}</p>}
        {featured ? (
          <>
            <article className="group grid overflow-hidden rounded-3xl border border-white/10 bg-[#101a2b] shadow-2xl lg:grid-cols-[1.2fr_1fr]">
              <Link href={`/news/${featured.slug}`} aria-label={`Read ${featured.title}`} className="relative min-h-[260px] overflow-hidden lg:min-h-[390px]">
                <Image src={featured.image_url || fallbackImage} alt="" fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#07101e]/60 via-transparent to-transparent" />
                <span className="absolute left-5 top-5 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">Featured</span>
              </Link>
              <div className="flex flex-col justify-center p-6 sm:p-9">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-blue-400">
                  <span>{featured.category}</span>{featured.region && <><span className="text-slate-600">·</span><span>{featured.region}</span></>}
                  <span className="text-slate-600">·</span><time dateTime={featured.published_at ?? featured.created_at}>{formatDate(featured.published_at)}</time>
                </div>
                <h3 className="text-3xl font-bold leading-tight text-white sm:text-4xl"><Link href={`/news/${featured.slug}`} className="transition hover:text-blue-200">{featured.title}</Link></h3>
                <p className="mt-5 text-base leading-7 text-slate-400">{featured.snippet}</p>
                <div className="mt-7 flex items-center gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" /> 4 min read</span>
                  <button type="button" onClick={() => void like(featured)} aria-label={`Like ${featured.title}`} className="flex items-center gap-1.5 transition hover:text-blue-300"><Heart className={`h-4 w-4 ${liked.includes(featured.id) ? "fill-blue-500 text-blue-500" : ""}`} /> {featured.likes_count}</button>
                  <button type="button" onClick={() => void share(featured)} aria-label={`Share ${featured.title}`} className="ml-auto flex items-center gap-1.5 hover:text-white"><Share2 className="h-4 w-4" /> Share</button>
                  <Link href={`/news/${featured.slug}`} className="flex items-center gap-1 font-semibold text-blue-400 hover:text-blue-300">Read story <ArrowRight className="h-4 w-4" /></Link>
                </div>
              </div>
            </article>
            {latest.length > 0 && (
              <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {latest.map((article) => (
                  <article key={article.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#101a2b] transition hover:-translate-y-1 hover:border-blue-400/30">
                    <Link href={`/news/${article.slug}`} className="relative block h-48 overflow-hidden">
                      <Image src={article.image_url || fallbackImage} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
                    </Link>
                    <div className="p-5">
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-blue-400"><span>{article.category}</span>{article.region && <><span className="text-slate-600">·</span><span>{article.region}</span></>}</div>
                      <h3 className="text-xl font-bold leading-snug text-white"><Link href={`/news/${article.slug}`} className="transition hover:text-blue-200">{article.title}</Link></h3>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{article.snippet}</p>
                      <div className="mt-5 flex items-center justify-between text-xs text-slate-500"><time dateTime={article.published_at ?? article.created_at}>{formatDate(article.published_at)}</time><Link href={`/news/${article.slug}`} className="font-semibold text-blue-400 hover:text-blue-300">Read story <ArrowRight className="inline h-3 w-3" /></Link></div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-[#101a2b] px-6 py-16 text-center">
            <Search className="mx-auto h-8 w-8 text-slate-500" />
            <h3 className="mt-4 text-xl font-bold text-white">{query || category !== "All" ? "No matching stories" : "No published stories yet"}</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">{query || category !== "All" ? "Try another search term or choose a different category." : "Our newsroom is preparing the latest reporting. Please check back soon."}</p>
          </div>
        )}
      </section>

      <section id="about" className="border-y border-white/10 bg-white/[.02]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.1fr_.9fr] md:items-center lg:px-8">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-400">About the newsroom</p><h2 className="mt-3 text-3xl font-bold text-white">Closer to the stories shaping Nigeria.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Next Level Media brings local and national reporting together, with a focus on the people, decisions and ideas moving our communities forward.</p></div>
          <div className="grid grid-cols-2 gap-3 text-sm font-semibold text-slate-200 sm:grid-cols-3"><span className="rounded-xl border border-white/10 bg-[#101a2b] p-4">Oyo</span><span className="rounded-xl border border-white/10 bg-[#101a2b] p-4">Osun</span><span className="rounded-xl border border-white/10 bg-[#101a2b] p-4">Lagos</span><span className="rounded-xl border border-white/10 bg-[#101a2b] p-4">Ekiti</span><span className="rounded-xl border border-white/10 bg-[#101a2b] p-4">Federal</span></div>
        </div>
      </section>

      <footer id="contact" className="bg-[#070c14]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_1fr] lg:px-8">
          <div><Logo /><p className="mt-5 max-w-md text-sm leading-6 text-slate-400">Independent Nigerian reporting with a local pulse and a national perspective.</p><a href="mailto:nextlevelmedia473@outlook.com" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300"><Mail className="h-4 w-4" /> Contact the newsroom</a></div>
          <form onSubmit={sendTip} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <h2 className="text-lg font-bold text-white">Have a story tip?</h2><p className="mt-1 text-sm text-slate-400">Help us report what matters to your community.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><input required name="name" placeholder="Your name" className="rounded-lg border border-white/10 bg-[#101a2b] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500" /><input required name="email" type="email" placeholder="Email address" className="rounded-lg border border-white/10 bg-[#101a2b] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500" /></div>
            <textarea required name="message" rows={3} placeholder="Tell us what is happening..." className="mt-3 w-full resize-y rounded-lg border border-white/10 bg-[#101a2b] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500" />
            <button className="mt-3 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500">Send a tip</button>
          </form>
        </div>
        <div className="border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-slate-500 sm:px-6 lg:px-8"><span>© {new Date().getFullYear()} Next Level Media. All rights reserved.</span><div className="flex gap-4"><a href="https://www.facebook.com/" aria-label="Facebook" className="hover:text-white"><Facebook className="h-4 w-4" /></a><a href="https://www.instagram.com/" aria-label="Instagram" className="hover:text-white"><Instagram className="h-4 w-4" /></a><a href="#top" className="hover:text-white">Back to top ↑</a></div></div></div>
      </footer>
      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-blue-400/30 bg-[#101a2b] px-5 py-3 text-sm text-white shadow-2xl">{notice}</div>}
    </main>
  );
}
