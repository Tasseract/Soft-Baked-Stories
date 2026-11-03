import Image from "next/image";
import Shop from "@/components/Shop";

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-30 px-4 pt-4">
        <nav className="glass mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2 sm:px-6">
          <a href="#top" aria-label="Soft Baked Stories home">
            <Image src="/images/logo.png" alt="Soft Baked Stories" width={186} height={53} priority className="h-10 w-auto" />
          </a>
          <div className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
            <a href="#menu" className="rounded-full px-3 py-2 hover:bg-white/60">Menu</a>
            <a href="#how" className="hidden rounded-full px-3 py-2 hover:bg-white/60 sm:inline">How it works</a>
          </div>
        </nav>
      </header>

      <main id="top" className="mx-auto max-w-6xl px-4 pb-32">
        <section className="grid items-center gap-8 pt-12 pb-10 md:grid-cols-[1.1fr_1fr] md:pt-20">
          <div>
            <p className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-rose">
              <span className="size-2 rounded-full bg-rose" /> Freshly home-baked · Delivered to you
            </p>
            <h1 className="font-display mt-5 text-5xl leading-[1.05] font-bold text-cocoa sm:text-6xl">
              Little bakes,<br />
              <span className="text-rose">big comfort.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-cocoa-soft">
              Fudgy muffins and moist banana breads, baked at home in small batches and brought right to your door.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#menu" className="rounded-full bg-rose px-6 py-3 font-bold text-white shadow-lg shadow-rose/30 transition hover:bg-rose-deep">
                Order now
              </a>
              <a href="#how" className="glass rounded-full px-6 py-3 font-bold text-cocoa transition hover:bg-white/70">
                How ordering works
              </a>
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-md">
            <div className="glass absolute inset-6 rounded-[3rem]" />
            <Image src="/images/smores-banana-muffin.png" alt="" width={396} height={416} priority className="absolute top-0 left-2 w-[55%] drop-shadow-2xl" />
            <Image src="/images/carrot-muffin.png" alt="" width={356} height={374} className="absolute top-[12%] right-0 w-[45%] rotate-6 drop-shadow-2xl" />
            <Image src="/images/smores-banana-bread.png" alt="" width={518} height={338} className="absolute bottom-0 left-[12%] w-[80%] -rotate-3 drop-shadow-2xl" />
          </div>
        </section>

        <Shop />

        <section id="how" className="mt-24 scroll-mt-28">
          <h2 className="font-display text-center text-4xl font-bold">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["1", "Pick your treats", "Add muffins by the piece or by the box, or grab a whole loaf."],
              ["2", "Tell us where", "Leave your name, number and delivery address. We'll text to confirm."],
              ["3", "Pay your way", "Cash on delivery, or scan our QR code and send the reference number."],
            ].map(([n, title, body]) => (
              <div key={n} className="glass rounded-3xl p-6">
                <span className="font-display grid size-10 place-items-center rounded-full bg-blush text-lg font-bold text-rose">{n}</span>
                <h3 className="font-display mt-4 text-xl font-semibold">{title}</h3>
                <p className="mt-1 text-cocoa-soft">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-center text-sm text-cocoa-soft">
        <div className="dotted-rule mb-6" />© {new Date().getFullYear()} Soft Baked Stories · Home-baked with love
      </footer>
    </>
  );
}
