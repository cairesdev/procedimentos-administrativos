"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Building2, ChevronRight, ClipboardCheck, FileSignature, Inbox, MapPin, Package, Route,
  ShieldCheck, Truck, Wrench,
} from "lucide-react";
import type { NavIcon, NavSection } from "@/shared/auth/modules";
import styles from "./WorkspaceSidebar.module.css";

const icons: Record<NavIcon, typeof Inbox> = {
  inbox: Inbox,
  fileSignature: FileSignature,
  building: Building2,
  shieldCheck: ShieldCheck,
  mapPin: MapPin,
  package: Package,
  clipboardCheck: ClipboardCheck,
  truck: Truck,
  route: Route,
  wrench: Wrench,
  boxes: Boxes,
};

export const WorkspaceSidebar = ({ sections }: { sections: NavSection[] }) => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const toggle = (group: string) =>
    setCollapsed((current) =>
      current.includes(group) ? current.filter((item) => item !== group) : [...current, group],
    );

  return (
    <nav className={styles.sidebar}>
      {sections.map((section) => {
        const Icon = icons[section.icon];
        const isOpen = !collapsed.includes(section.group);

        return (
          <div key={section.group} className={styles.section}>
            <button
              type="button"
              className={styles.section_header}
              onClick={() => toggle(section.group)}
              aria-expanded={isOpen}
            >
              <span className={styles.section_icon}>
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className={styles.section_label}>{section.group}</span>
              <ChevronRight
                size={14}
                aria-hidden="true"
                className={`${styles.chevron} ${isOpen ? styles.chevron_open : ""}`}
              />
            </button>

            {isOpen ? (
              <div className={styles.links}>
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`${styles.link} ${
                      pathname.startsWith(link.href) ? styles.link_active : ""
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
};
