"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Clock3, Heart, Send, Share2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type Article = {
  id: string;
  title: string;
  slug: string;
  content: string;
  snippet: string;
  image_url: string | null;
  category: string;
  region: string | null;
  source_name: string | null;
  published_at: string | null;
  likes_count: number;
};
type Comment = { id: string; content: string; created_at: string };

export default function NewsArticlePage({ slug, initialArticle }: { slug: string; initialArticle: Article | null }) {
  const [article, setArticle] = useState<Article | null>(initialArticle);
  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadComments(articleId: string) {
      const { data, error } = await supabase
        .from("comments")
        .select("id, content, created_at")
        .eq("article_id", articleId)
        .order("created_at", { ascending: false });
      if (error) console.error("Could not load article comments", error.message);
      if (active && data) setComments(data as Comment[]);
    }

    if (initialArticle) {
      setArticle(initialArticle);
      void loadComments(initialArticle.id);
    } else {
      void (async () => {
        const { data, error } = await supabase
          .from("articles")
          .select("id, title, slug, content, snippet, image_url, category, region, source_name, published_at, likes_count")
          .eq("slug", slug)
          .eq("status", "published")
          .maybeSingle();
        if (error) {
          console.error("Could not load article", error.message);
          return;
        }
        if (!data || !active) return;
        const loadedArticle = data as Article;
        setArticle(loadedArticle);
        await loadComments(loadedArticle.id);
      })();
    }
    return () => {
      active = false;
    };
  }, [initialArticle, slug]);

  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value))
    : "Just now";

  const share = async () => {
    if (!article) return;
    try {
      if (navigator.share) await navigator.share({ title: article.title, text: article.snippet, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setNotice("Article link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Could not share article", error);
      setNotice("The article link could not be shared.");
    }
  };

  const like = async () => {
    if (!article || liked) return;
    const previousCount = article.likes_count;
    setLiked(true);
    setArticle({ ...article, likes_count: previousCount + 1 });
    const { error } = await supabase.from("articles").update({ likes_count: previousCount + 1 }).eq("id", article.id);
    if (error) {
      console.error("Could not update article likes", error.message);
      setLiked(false);
      setArticle({ ...article, likes_count: previousCount });
      setNotice("Your like could not be saved.");
    }
  };

  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!comment.trim() || !article) return;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error("Could not check comment author", userError.message);
      setNotice("Your session could not be checked. Please sign in again.");
      return;
    }
    if (!user) {
      setNotice("Sign in is required to comment.");
      return;
    }
    const { data, error } = await supabase
      .from("comments")
      .insert({ article_id: article.id, content: comment.trim() })
      .select("id, content, created_at")
      .maybeSingle();
    if (error) {
      console.error("Could not post reader comment", error.message);
      setNotice("That comment could not be posted.");
    } else if (data) {
      setComments((items) => [data as Comment, ...items]);
      setComment("");
    }
  };

  if (!article) {
    return <main className="grid min-h-screen place-items-center bg-[#080e19] px-6 text-center text-slate-400"><div><p>Loading story…</p><a href="/" className="mt-4 inline-flex items-center gap-2 text-sm text-blue-400"><ArrowLeft className="h-4 w-4" /> Back to newsroom</a></div></main>;
  }

  return (
    <main className="min-h-screen bg-[#080e19] text-white">
      <header className="border-b border-white/10 bg-[#080e19]/90 px-4 py-5 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <a href="/" className="inline-flex items-center gap-3 text-sm font-semibold text-slate-300 hover:text-white"><Image src="/hero.jpg" alt="" width={36} height={36} className="h-9 w-9 rounded-lg object-cover" /><ArrowLeft className="h-4 w-4" /> Next Level Media</a>
          <button onClick={() => void share()} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 hover:border-blue-500"><Share2 className="h-4 w-4" /> Share</button>
        </div>
      </header>
      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[.18em] text-blue-400">
          <span>{article.category}</span>
          {article.region && <><span className="text-slate-600">·</span><span>{article.region}</span></>}
          <span className="text-slate-600">·</span><time dateTime={article.published_at ?? undefined}>{formatDate(article.published_at)}</time>
        </div>
        <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-6xl">{article.title}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">{article.snippet}</p>
        <div className="relative mt-10 h-64 overflow-hidden rounded-3xl border border-white/10 sm:h-[30rem]">
          <Image src={article.image_url || "/hero.jpg"} alt="" fill priority sizes="(min-width: 896px) 896px, 100vw" className="object-cover" />
        </div>
        <div className="mx-auto max-w-2xl">
          <div className="mt-8 flex flex-wrap gap-3 border-y border-white/10 py-5">
            <button onClick={() => void like()} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 hover:border-blue-500"><Heart className={`h-4 w-4 ${liked ? "fill-blue-500 text-blue-500" : ""}`} /> {article.likes_count} likes</button>
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" /> Short excerpt</span>
          </div>
          <div className="mt-8 whitespace-pre-line text-lg leading-9 text-slate-200">{article.content}</div>
          <section className="mt-14 border-t border-white/10 pt-8">
            <h2 className="text-2xl font-bold">Join the conversation</h2>
            <form onSubmit={addComment} className="mt-5 flex gap-2">
              <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Share your perspective..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm outline-none focus:border-blue-500" />
              <button aria-label="Post comment" className="rounded-xl bg-blue-600 px-4 text-white"><Send className="h-4 w-4" /></button>
            </form>
            <div className="mt-5 grid gap-3">{comments.map((item) => <div key={item.id} className="rounded-xl bg-white/[.04] p-4 text-sm leading-6 text-slate-300">{item.content}</div>)}</div>
          </section>
        </div>
      </article>
      <footer className="border-t border-white/10 bg-[#070c14]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:px-6">
          <span>© {new Date().getFullYear()} Next Level Media</span>
          <a href="/" className="font-semibold text-blue-400 hover:text-blue-300">Back to the newsroom</a>
        </div>
      </footer>
      {notice && <div role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-blue-400/30 bg-[#101a2b] px-5 py-3 text-sm text-white shadow-2xl">{notice}</div>}
    </main>
  );
}
