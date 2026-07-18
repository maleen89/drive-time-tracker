import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/setup", label: "Setup" },
  { href: "/measurements", label: "History" },
];

export function Nav() {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          Drive Time Tracker
        </Link>
        <div className="flex gap-4 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-slate-600 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
