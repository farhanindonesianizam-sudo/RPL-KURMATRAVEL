import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import "./admin.css";

const pageMap = {
  "/": "index.html",
  "/index.html": "index.html",
  "/paket": "paket.html",
  "/paket.html": "paket.html",
  "/galeri": "galeri.html",
  "/galeri.html": "galeri.html",
  "/staf": "staf.html",
  "/staf.html": "staf.html",
  "/kontak": "kontak.html",
  "/kontak.html": "kontak.html",
  "/tentang": "tentang.html",
  "/tentang.html": "tentang.html",
  "/keunggulan": "keunggulan.html",
  "/keunggulan.html": "keunggulan.html",
  "/syarat": "syarat.html",
  "/syarat.html": "syarat.html",
  "/perlengkapan": "perlengkapan.html",
  "/perlengkapan.html": "perlengkapan.html",
  "/artikel": "artikel.html",
  "/artikel.html": "artikel.html",
  "/artikel-haji": "artikel-haji.html",
  "/artikel-haji.html": "artikel-haji.html",
  "/artikel-manfaat": "artikel-manfaat.html",
  "/artikel-manfaat.html": "artikel-manfaat.html",
  "/artikel-tips": "artikel-tips.html",
  "/artikel-tips.html": "artikel-tips.html",
};

function LegacyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [html, setHtml] = useState("");
  const [pageStyles, setPageStyles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const pathName = location.pathname.replace(/\/+$/, "") || "/";
    const page = pageMap[pathName] || `${pathName.replace(/^\/+/, "") || "index"}.html`;
    setError("");
    setHtml("");

    fetch(`/api/page/${encodeURIComponent(page)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Halaman tidak ditemukan");
        return response.json();
      })
      .then((data) => {
        const document = new DOMParser().parseFromString(data.html, "text/html");
        setPageStyles(Array.from(document.querySelectorAll("style")).map((style) => style.textContent));
        if (document.title) window.document.title = document.title;
        setHtml(document.body.innerHTML);
      })
      .catch(async (reason) => {
        try {
          const currentRoute = location.pathname.replace(/\/+$/, "").replace(/\.html$/, "");
          const contentResponse = await fetch("/api/content", { cache: "no-store" });
          if (!contentResponse.ok) throw reason;
          const content = await contentResponse.json();
          let detailSection = "";
          let detailItem = null;
          const articleItems = Array.isArray(content.articles) ? content.articles : [];
          const informationItems = Array.isArray(content.information) ? content.information : [];
          detailItem = articleItems.find((item) => {
            const itemRoute = String(item.url || "")
              .replace(/\/+$/, "")
              .replace(/\.html$/, "");
            return itemRoute === currentRoute;
          });
          if (detailItem) detailSection = "articles";
          if (!detailItem) {
            detailItem = informationItems.find((item) => {
              const itemRoute = String(item.url || "")
                .replace(/\/+$/, "")
                .replace(/\.html$/, "");
              return itemRoute === currentRoute;
            });
            if (detailItem) detailSection = "information";
          }
          if (!detailItem) throw reason;

          window.document.title = detailItem.title || "Artikel & Informasi";
          const returnButtonStyles = `
            body .cms-detail-back{display:flex;justify-content:center;margin-top:38px;padding-top:26px;border-top:1px solid var(--border)}
            body .cms-detail-back a{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:13px 27px;color:var(--white);background:linear-gradient(135deg,#f58a3d,var(--primary));border:1px solid transparent;border-radius:50px;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 7px 18px rgba(237,107,35,.2);transition:transform .25s ease,box-shadow .25s ease,background .25s ease}
            body .cms-detail-back a:hover{background:linear-gradient(135deg,var(--primary),var(--primary-dark));transform:translateY(-3px);box-shadow:0 11px 24px rgba(237,107,35,.28)}
            body .cms-detail-back a:focus-visible{outline:3px solid rgba(237,107,35,.4);outline-offset:4px}
          `;
          const templateName = detailSection === "information" ? "tentang.html" : "artikel-tips.html";
          const templateResponse = await fetch(`/api/page/${templateName}`);
          if (templateResponse.ok) {
            const templateData = await templateResponse.json();
            const templateDocument = new DOMParser().parseFromString(templateData.html, "text/html");
            const templateHeroTitle = templateDocument.querySelector(".hero h1");
            const templateContent = templateDocument.querySelector(".content");
            if (templateHeroTitle) templateHeroTitle.textContent = detailItem.title || "";
            if (templateContent) {
              templateContent.innerHTML = `${detailItem.description || "<p>Konten belum tersedia.</p>"}
                <div class="back cms-detail-back"><a href="/artikel">⬅ Kembali ke Artikel</a></div>`;
            }
            setPageStyles([
              ...Array.from(templateDocument.querySelectorAll("style")).map((style) => style.textContent),
              returnButtonStyles,
            ]);
            setHtml(templateDocument.body.innerHTML);
          } else {
            setPageStyles([returnButtonStyles]);
            setHtml(`
              <main class="cms-detail-page legacy-page">
                <h1>${escapeHtml(detailItem.title || "")}</h1>
                <div class="content">
                  ${detailItem.description || "<p>Konten belum tersedia.</p>"}
                  <div class="back cms-detail-back"><a href="/artikel">⬅ Kembali ke Artikel</a></div>
                </div>
              </main>
            `);
          }
        } catch {
          setError(reason.message);
        }
      });
  }, [location.pathname]);

  useEffect(() => {
    if (!html) return;

    const parser = new DOMParser();
    const document = parser.parseFromString(html, "text/html");
    const title = document.querySelector("title")?.textContent;
    if (title) window.document.title = title;

    window.document.querySelectorAll("style[data-legacy-page-style]").forEach((style) => style.remove());
    const styleCleanup = pageStyles.map((styleText) => {
      const style = window.document.createElement("style");
      style.dataset.legacyPageStyle = "true";
      style.textContent = styleText;
      window.document.head.appendChild(style);
      return () => style.remove();
    });

    const isHome = location.pathname === "/" || location.pathname === "/index.html";
    let cssPath = isHome ? "/static/css/home.css" : "/static/css/style.css";
    let cssLink = document.querySelector("#legacy-react-css");
    if (!cssLink) {
      cssLink = window.document.createElement("link");
      cssLink.id = "legacy-react-css";
      cssLink.rel = "stylesheet";
      window.document.head.appendChild(cssLink);
    }
    cssLink.href = cssPath;

    const body = window.document.querySelector(".legacy-page");
    if (body) {
      const cleanup = [];
      if (!body.querySelector("#waFloat")) {
        const floatButton = window.document.createElement("div");
        floatButton.id = "waFloat";
        floatButton.className = "wa-float show";
        floatButton.setAttribute("role", "button");
        floatButton.setAttribute("tabindex", "0");
        floatButton.setAttribute("aria-label", "Chat WhatsApp");
        floatButton.innerHTML = `
          <span class="wa-tooltip"></span>
          <svg viewBox="0 0 32 32" width="30" height="30" fill="white" aria-hidden="true">
            <path d="M16 2.9C8.8 2.9 2.9 8.8 2.9 16c0 2.3.6 4.5 1.8 6.5L3 29l6.7-1.7A13 13 0 1 0 16 2.9zm0 23.7c-2.1 0-4.1-.6-5.9-1.7l-.4-.2-3.9 1 1-3.8-.2-.4A10.9 10.9 0 1 1 16 26.6zm6.1-8.1c-.3-.1-1.8-.9-2.1-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.6-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.4.1-.1.2-.3.3-.5.1-.2 0-.4-.1-.6-.1-.1-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8 0 1.7 1.2 3.3 1.4 3.5.2.2 2.4 3.7 5.8 5 3.4 1.3 3.4.9 4 .8.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3z"/>
          </svg>`;
        const openConsultation = () => window.openWA?.(
          "Halo Kurma Travel, saya mau konsultasi terkait paket umrah/haji yang tersedia"
        );
        floatButton.addEventListener("click", openConsultation);
        floatButton.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") openConsultation();
        });
        cleanup.push(() => {
          floatButton.removeEventListener("click", openConsultation);
        });
        body.appendChild(floatButton);
      } else {
        body.querySelector("#waFloat")?.classList.add("show");
      }
      body.querySelectorAll("a[href], [onclick]").forEach((node) => {
        if (node.matches("a[href]")) {
          const href = node.getAttribute("href");
          if (href && !href.startsWith("http") && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("javascript:")) {
            const cleanHref = href.replace(/^\.\//, "");
            const route = cleanHref.endsWith(".html")
              ? "/" + cleanHref
              : "/" + cleanHref;
            const handler = (event) => {
              event.preventDefault();
              navigate(route);
            };
            node.addEventListener("click", handler);
            cleanup.push(() => node.removeEventListener("click", handler));
          }
        }

        const inlineClick = node.getAttribute("onclick");
        if (inlineClick?.includes("openWA")) {
          const messageMatch = inlineClick.match(/openWA\(['"`](.*?)['"`]\)/);
          const message = messageMatch?.[1] || "Halo Kurma Travel, saya mau konsultasi";
          const handler = (event) => {
            event.prevent?.();
            window.openWA?.(message);
          };
          node.addEventListener("click", handler);
          cleanup.push(() => node.removeEventListener("click", handler));
        }
        if (inlineClick?.includes("closeWA")) {
          const handler = (event) => {
            event.prevent?.();
            window.closeWA?.();
          };
          node.addEventListener("click", handler);
          cleanup.push(() => node.removeEventListener("click", handler));
        }
      });

      const hamburger = body.querySelector("#hamburger");
      const navMenu = body.querySelector("#navMenu");
      if (hamburger && navMenu) {
        const handler = () => navMenu.classList.toggle("active");
        hamburger.addEventListener("click", handler);
        cleanup.push(() => hamburger.removeEventListener("click", handler));
      }

      body.querySelectorAll(".btn-wa").forEach((button) => {
        button.textContent = "Login Admin";
        button.removeAttribute("onclick");
        button.setAttribute("href", "/admin/login");
        const handler = (event) => {
          event.preventDefault();
          navigate("/admin/login");
        };
        button.addEventListener("click", handler);
        cleanup.push(() => button.removeEventListener("click", handler));
      });

      if (location.pathname === "/galeri" || location.pathname === "/galeri.html") {
        const grid = body.querySelector(".gallery-grid");
        if (grid) {
          grid.querySelectorAll("img").forEach((img) => img.remove());
          const fragment = window.document.createDocumentFragment();
          const localGallery = Array.from({ length: 224 }, (_, index) => ({
            title: `Dokumentasi Kurma Travel ${index + 1}`,
            image: `/static/images/gallery/gallery${index + 1}.jpg`,
          }));
          localGallery.forEach((item) => {
            const img = window.document.createElement("img");
            img.src = item.image;
            img.alt = item.title;
            img.loading = "lazy";
            img.decoding = "async";
            img.tabIndex = 0;
            img.setAttribute("role", "button");
            img.addEventListener("click", () => window.openLightbox?.(img.src));
            img.addEventListener("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                window.openLightbox?.(img.src);
              }
            });
            img.addEventListener("error", () => img.remove());
            fragment.appendChild(img);
          });
          grid.replaceChildren(fragment);
          window.galleryImages = localGallery.map((item) => item.image);

          const delegatedGalleryClick = (event) => {
            const target = event.target.closest?.(".gallery-grid img");
            if (target) window.openLightbox?.(target.src);
          };
          grid.addEventListener("click", delegatedGalleryClick);
          cleanup.push(() => grid.removeEventListener("click", delegatedGalleryClick));
        }
      }

      fetch("/api/content")
        .then((response) => response.ok ? response.json() : null)
        .then((content) => {
          if (!content) return;
          const theme = content.theme || {};
          const themeVariables = {
            "--primary": theme.primary,
            "--primary-dark": theme.primary_dark,
            "--navbar-color": theme.navbar,
            "--green": theme.green,
            "--green-dark": theme.green_dark,
            "--bg": theme.background,
          };
          Object.entries(themeVariables).forEach(([name, value]) => {
            if (value) window.document.documentElement.style.setProperty(name, value);
          });
          body.querySelectorAll(".navbar").forEach((navbar) => {
            if (theme.navbar) navbar.style.backgroundColor = theme.navbar;
          });

          if (location.pathname === "/" || location.pathname === "/index.html") {
            const slider = body.querySelector(".slider");
            const slides = body.querySelector(".slides");
            const prev = body.querySelector(".slider .prev");
            const next = body.querySelector(".slider .next");
            if (slides) {
              slides.replaceChildren();
              let galleryItems = content.gallery.filter((item) => item.image && !item.hidden && !item.deleted_at);
                const hasGalleryRecords = content.gallery.some((item) => item.image && !item.deleted_at);
              if (galleryItems.length === 0 && !hasGalleryRecords) {
                galleryItems = Array.from({ length: 224 }, (_, index) => ({
                  title: `Dokumentasi Kurma Travel ${index + 1}`,
                  image: `/static/images/gallery/gallery${index + 1}.jpg`,
                }));
              }
              window.galleryImages = galleryItems.map((item) => item.image);
              galleryItems.forEach((item) => {
                const img = window.document.createElement("img");
                img.src = item.image;
                img.alt = item.title || "Dokumentasi Kurma Travel";
                img.loading = "lazy";
                img.addEventListener("error", () => img.remove());
                img.addEventListener("click", () => window.openLightbox?.(img.src));
                slides.appendChild(img);
              });

              let index = 0;
              const update = () => {
                const firstImage = slides.querySelector("img");
                if (!firstImage) return;
                const gap = 15;
                const itemWidth = firstImage.offsetWidth + gap;
                const visibleWidth = slider?.clientWidth || window.innerWidth;
                const maxIndex = Math.max(0, Math.ceil((slides.scrollWidth - visibleWidth) / itemWidth));
                index = Math.min(index, maxIndex);
                slides.style.transform = `translateX(-${index * itemWidth}px)`;
              };
              const move = (direction) => {
                const firstImage = slides.querySelector("img");
                if (!firstImage) return;
                const itemWidth = firstImage.offsetWidth + 15;
                const maxIndex = Math.max(0, Math.ceil((slides.scrollWidth - (slider?.clientWidth || window.innerWidth)) / itemWidth));
                index = direction > 0
                  ? (index >= maxIndex ? 0 : index + 1)
                  : (index <= 0 ? maxIndex : index - 1);
                update();
              };
              const nextHandler = () => move(1);
              const prevHandler = () => move(-1);
              next?.addEventListener("click", nextHandler);
              prev?.addEventListener("click", prevHandler);
              cleanup.push(() => {
                next?.removeEventListener("click", nextHandler);
                prev?.removeEventListener("click", prevHandler);
              });
              requestAnimationFrame(update);
              window.addEventListener("resize", update);
              cleanup.push(() => window.removeEventListener("resize", update));
              if (galleryItems.length > 0) {
                const interval = window.setInterval(() => move(1), 4000);
                cleanup.push(() => window.clearInterval(interval));
              }
            }
          }

          if (
            location.pathname === "/paket" ||
            location.pathname === "/paket.html" ||
            location.pathname === "/" ||
            location.pathname === "/index.html"
          ) {
            const grid = location.pathname === "/" || location.pathname === "/index.html"
              ? body.querySelector(".home-package-grid")
              : body.querySelector(".package-grid");
            const isHome = location.pathname === "/" || location.pathname === "/index.html";
            if (grid) grid.replaceChildren();
            content.packages.forEach((item) => {
              const card = window.document.createElement("article");
              card.className = isHome ? "home-package-card" : "travel-card";
              if (!isHome && (item.badge || "").toUpperCase().includes("RAMADHAN")) {
                card.classList.add("featured");
              }
              if (item.image) {
                const poster = window.document.createElement("div");
                poster.className = isHome ? "home-package-image" : "travel-poster";
                const image = window.document.createElement("img");
                image.src = item.image;
                image.alt = item.title || "";
                poster.appendChild(image);
                if (!isHome) {
                  const badge = window.document.createElement("span");
                  badge.className = "travel-badge" + ((item.badge || "").toUpperCase().includes("RAMADHAN") ? " ramadhan-badge" : "");
                  badge.textContent = item.badge || "PAKET UMRAH";
                  poster.prepend(badge);
                }
                card.appendChild(poster);
              }
              const cardContent = window.document.createElement("div");
              cardContent.className = isHome ? "home-package-body" : "travel-content";
              const category = window.document.createElement("span");
              category.className = isHome ? "home-package-category" : "travel-category";
              category.textContent = item.category || "PAKET PERJALANAN";
              const title = window.document.createElement("h3");
              title.textContent = item.title || "Paket perjalanan";
              const description = window.document.createElement("p");
              description.className = isHome ? "home-package-description" : "travel-description";
              description.textContent = item.description || "";
              cardContent.append(category, title, description);
              if (!isHome) {
                const info = window.document.createElement("div");
                info.className = "travel-info";
                [
                  ["🕋", item.program || "Perjalanan ibadah Umrah"],
                  ["📅", item.period || "Periode keberangkatan"],
                  ["⏱️", item.duration || "Durasi perjalanan"],
                ].forEach(([icon, text]) => {
                  const span = window.document.createElement("span");
                  span.textContent = `${icon} ${text}`;
                  info.appendChild(span);
                });
                cardContent.appendChild(info);

                const footer = window.document.createElement("div");
                footer.className = "travel-footer";
                const price = window.document.createElement("div");
                price.className = "travel-price";
                const priceLabel = window.document.createElement("small");
                priceLabel.textContent = item.price || "Informasi harga";
                const priceValue = window.document.createElement("strong");
                priceValue.textContent = item.detail || item.price || "Lihat Detail / Hubungi Kami";
                price.append(priceLabel, priceValue);

                const actions = window.document.createElement("div");
                actions.className = "package-actions";
                const detail = window.document.createElement("button");
                detail.type = "button";
                detail.className = "detail-btn";
                detail.textContent = "Lihat Detail Poster ↗";
                detail.addEventListener("click", () => window.openPoster?.(item.image));
                const ask = window.document.createElement("button");
                ask.type = "button";
                ask.className = "travel-button";
                ask.textContent = "Tanya Paket ↗";
                ask.addEventListener("click", () => window.openWA?.(item.title || "Halo Kurma Travel, saya mau tanya paket"));
                actions.append(detail, ask);
                footer.append(price, actions);
                cardContent.appendChild(footer);
              }
              card.appendChild(cardContent);
              grid?.appendChild(card);
            });
          }

          if (location.pathname === "/galeri" || location.pathname === "/galeri.html") {
            const grid = body.querySelector(".gallery-grid");
            if (grid) grid.replaceChildren();
            const visibleGallery = content.gallery.filter((item) => item.image && !item.hidden && !item.deleted_at);
            const hasGalleryRecords = content.gallery.some((item) => item.image && !item.deleted_at);
            const galleryItems = hasGalleryRecords
              ? visibleGallery
              : Array.from({ length: 224 }, (_, index) => ({
                  title: `Dokumentasi Kurma Travel ${index + 1}`,
                  image: `/static/images/gallery/gallery${index + 1}.jpg`,
                }));
            const galleryImages = galleryItems.map((item) => item.image);
            const fragment = window.document.createDocumentFragment();
            galleryItems.forEach((item) => {
              const img = window.document.createElement("img");
              img.src = item.image || "";
              img.alt = item.title || "Dokumentasi Kurma Travel";
              img.loading = "lazy";
              img.decoding = "async";
              img.tabIndex = 0;
              img.setAttribute("role", "button");
              img.addEventListener("click", () => window.openLightbox?.(img.src));
              img.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  window.openLightbox?.(img.src);
                }
              });
              img.addEventListener("error", () => img.remove());
              if (item.image) fragment.appendChild(img);
            });
            window.galleryImages = galleryImages;
            grid?.replaceChildren(fragment);
          }

          if (location.pathname === "/perlengkapan" || location.pathname === "/perlengkapan.html") {
            const grid = body.querySelector("#perlengkapan");
            const lightbox = body.querySelector("#lightbox");
            const lightboxImage = body.querySelector("#lightbox-img");
            if (grid) {
              grid.replaceChildren();
              const equipmentItem = content.information?.find((item) =>
                String(item.url || "").replace(/\/+$/, "").replace(/\.html$/, "") === "/perlengkapan"
              );
              const existingFeatureGrid = body.querySelector("#equipment-feature-grid");
              if (existingFeatureGrid) existingFeatureGrid.remove();
              const equipmentFeatures = Array.isArray(equipmentItem?.equipment_features)
                ? equipmentItem.equipment_features.filter((feature) => feature && String(feature.title || "").trim())
                : [];
              if (equipmentFeatures.length) {
                const featureGrid = window.document.createElement("div");
                featureGrid.id = "equipment-feature-grid";
                featureGrid.className = "equipment-feature-grid";
                const featureStyle = window.document.createElement("style");
                featureStyle.textContent = `
                  .equipment-feature-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:0 0 28px}
                  .equipment-feature-card{min-width:0;min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:22px 14px;text-align:center;color:#392a22;background:linear-gradient(135deg,#fff,#fffaf5);border:1px solid #f0e2d5;border-radius:16px;box-shadow:0 7px 20px rgba(55,35,22,.08)}
                  .equipment-feature-card strong{display:block;font-size:15px;line-height:1.45}
                  .equipment-feature-icon{min-width:48px;height:48px;display:flex;align-items:center;justify-content:center;color:#ed7028;background:#fff7ef;border:1px solid #f0e2d5;border-radius:50%;font-size:24px;font-weight:800;line-height:1}
                  .equipment-feature-image{width:58px;height:58px;object-fit:contain}
                  @media(max-width:900px){.equipment-feature-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
                  @media(max-width:420px){.equipment-feature-grid{grid-template-columns:1fr}}
                  .content>h2,.content>h3{margin:34px 0 14px;color:#392a22;line-height:1.35}
                  .content>h2{font-size:25px}.content>h3{font-size:20px}
                  .content>ul,.content>ol{margin:20px 0;padding:18px 22px 18px 44px;color:#76675d;background:#fff9f3;border:1px solid #f0e2d5;border-radius:13px;font-size:15px;line-height:1.85}
                  .content>ul li,.content>ol li{margin:6px 0;padding-left:4px}.content>ul{list-style-type:disc}
                `;
                body.appendChild(featureStyle);
                cleanup.push(() => featureStyle.remove());
                equipmentFeatures.forEach((feature, featureIndex) => {
                  const card = window.document.createElement("div");
                  card.className = "equipment-feature-card";
                  const icon = window.document.createElement("div");
                  icon.className = "equipment-feature-icon";
                  icon.textContent = feature.icon || "◆";
                  const title = window.document.createElement("strong");
                  title.textContent = String(feature.title || "");
                  card.appendChild(icon);
                  card.appendChild(title);
                  if (feature.image) {
                    const image = window.document.createElement("img");
                    image.className = "equipment-feature-image";
                    image.src = feature.image;
                    image.alt = String(feature.title || `Fitur ${featureIndex + 1}`);
                    card.insertBefore(image, title);
                    icon.remove();
                  }
                  featureGrid.appendChild(card);
                });
                grid.before(featureGrid);
              }

              // Render from the CMS API directly so newly added cards and icon changes
              // never depend on a delayed React content-state refresh.
              fetch("/api/content", { cache: "no-store" })
                .then((response) => response.ok ? response.json() : null)
                .then((cmsContent) => {
                  if (!cmsContent?.information || !location.pathname.startsWith("/perlengkapan")) return;
                  const cmsItem = cmsContent.information.find((item) =>
                    String(item.url || "").replace(/\/+$/, "").replace(/\.html$/, "") === "/perlengkapan"
                  );
                  const cmsFeatures = Array.isArray(cmsItem?.equipment_features)
                    ? cmsItem.equipment_features.filter((feature) =>
                        feature && String(feature.title || "").trim())
                    : [];
                  if (!cmsFeatures.length) return;

                  body.querySelector("#equipment-feature-grid")?.remove();
                  const cmsFeatureGrid = window.document.createElement("div");
                  cmsFeatureGrid.id = "equipment-feature-grid";
                  cmsFeatureGrid.className = "equipment-feature-grid";
                  cmsFeatureGrid.style.cssText = "display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:0 0 28px";

                  cmsFeatures.forEach((feature, featureIndex) => {
                    const card = window.document.createElement("div");
                    card.className = "equipment-feature-card";
                    card.style.cssText = "min-width:0;min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:22px 14px;text-align:center;color:#392a22;background:linear-gradient(135deg,#fff,#fffaf5);border:1px solid #f0e2d5;border-radius:16px;box-shadow:0 7px 20px rgba(55,35,22,.08)";

                    if (feature.image) {
                      const image = window.document.createElement("img");
                      image.className = "equipment-feature-image";
                      image.src = feature.image;
                      image.alt = String(feature.title || `Fitur ${featureIndex + 1}`);
                      image.style.cssText = "width:58px;height:58px;object-fit:contain";
                      card.appendChild(image);
                    } else {
                      const icon = window.document.createElement("div");
                      icon.className = "equipment-feature-icon";
                      icon.style.cssText = "min-width:48px;height:48px;display:flex;align-items:center;justify-content:center;color:#ed7028;background:#fff7ef;border:1px solid #f0e2d5;border-radius:50%;font-size:24px;font-weight:800;line-height:1";
                      const rawIcon = String(feature.icon || "◆");
                      const title = String(feature.title || "");
                      icon.textContent = rawIcon.includes(title)
                        ? (rawIcon.replace(title, "").trim() || "◆")
                        : rawIcon;
                      card.appendChild(icon);
                    }

                    const cardTitle = window.document.createElement("strong");
                    cardTitle.textContent = String(feature.title || "");
                    cardTitle.style.cssText = "display:block;font-size:15px;line-height:1.45";
                    card.appendChild(cardTitle);
                    cmsFeatureGrid.appendChild(card);
                  });

                  const cmsGrid = body.querySelector("#perlengkapan");
                  cmsGrid?.before(cmsFeatureGrid);
                })
                .catch(() => {});
              const equipmentTextBlocks = getEquipmentTextBlocks(equipmentItem);
              const contentElement = body.querySelector(".content");
              if (contentElement) {
                Array.from(contentElement.querySelectorAll(":scope > p")).forEach((paragraph) => paragraph.remove());
                const backElement = contentElement.querySelector(":scope > .back");
                equipmentTextBlocks.forEach((block) => {
                  if (!block || !String(block.text || "").trim()) return;
                  const element = window.document.createElement(block.type === "heading"
                    ? (block.level === "h3" ? "h3" : "h2")
                    : block.type === "list" ? (block.ordered ? "ol" : "ul") : "p");
                  if (block.type === "list") {
                    (block.items || [])
                      .map((text) => String(text || "").trim())
                      .filter(Boolean)
                      .forEach((text) => {
                      const item = window.document.createElement("li");
                      item.textContent = String(text);
                      element.appendChild(item);
                    });
                  } else {
                    element.textContent = String(block.text || "");
                  }
                  if (element.tagName === "P" || element.tagName === "UL" || element.tagName === "OL") {
                    element.style.marginTop = "40px";
                  }
                  contentElement.insertBefore(element, backElement || null);
                });
              }
              const equipmentImages = Array.isArray(equipmentItem?.equipment_images)
                ? equipmentItem.equipment_images.filter(Boolean)
                : Array.from({ length: 11 }, (_, index) => `/static/images/perlengkapan/perlengkapan${index + 1}.jpg`);
              window.galleryImages = equipmentImages;
              equipmentImages.forEach((imageUrl, index) => {
                const image = window.document.createElement("img");
                image.src = imageUrl;
                image.alt = `Perlengkapan Umrah & Haji ${index}`;
                image.loading = "lazy";
                image.decoding = "async";
                image.tabIndex = 0;
                image.setAttribute("role", "button");
                const openEquipmentLightbox = () => {
                  if (!lightbox || !lightboxImage) return;
                  lightboxImage.src = image.src;
                  lightbox.style.display = "flex";
                };
                image.addEventListener("click", openEquipmentLightbox);
                image.addEventListener("keydown", (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openEquipmentLightbox();
                  }
                });
                image.addEventListener("error", () => image.remove());
                grid.appendChild(image);
              });
            }
            if (lightbox) {
              const closeEquipmentLightbox = () => {
                lightbox.style.display = "none";
              };
              lightbox.addEventListener("click", closeEquipmentLightbox);
              cleanup.push(() => lightbox.removeEventListener("click", closeEquipmentLightbox));
              const escapeEquipmentLightbox = (event) => {
                if (event.key === "Escape") closeEquipmentLightbox();
              };
              window.document.addEventListener("keydown", escapeEquipmentLightbox);
              cleanup.push(() => window.document.removeEventListener("keydown", escapeEquipmentLightbox));
            }
          }

          if (location.pathname === "/staf" || location.pathname === "/staf.html") {
            const grid = body.querySelector(".staff-grid-4");
            if (grid) grid.replaceChildren();
            const directorCard = body.querySelector(".staff-center .staff-card");
            const director = content.staff.find((item) =>
              /direktur/i.test(`${item.category || ""} ${item.title || ""}`)
            );
            if (directorCard && director) {
              const directorImage = directorCard.querySelector("img");
              const directorLabel = directorCard.querySelector(".staff-label");
              if (directorImage) {
                directorImage.src = director.image || "";
                directorImage.alt = director.title || "Direktur Kurma Travel";
              }
              if (directorLabel) {
                directorLabel.replaceChildren(window.document.createTextNode(director.title || ""));
                const directorRole = window.document.createElement("span");
                directorRole.textContent = director.category || "";
                directorLabel.appendChild(directorRole);
              }
            }
            const staffMembers = orderedStaff(content.staff).filter((item) =>
              !/direktur/i.test(`${item.category || ""} ${item.title || ""}`)
            );
            staffMembers.forEach((item) => {
              const card = window.document.createElement("div");
              card.className = "staff-card";
              const image = window.document.createElement("img");
              image.src = item.image || "";
              image.alt = item.title || "Staf Kurma Travel";
              const label = window.document.createElement("div");
              label.className = "staff-label";
              label.append(window.document.createTextNode(item.title || ""));
              const role = window.document.createElement("span");
              role.textContent = item.category || "";
              label.appendChild(role);
              card.append(image, label);
              grid?.appendChild(card);
            });
          }

          if (location.pathname === "/kontak" || location.pathname === "/kontak.html") {
            const grid = body.querySelector(".contact-grid");
            if (grid) grid.replaceChildren();
            const whatsappContacts = content.contacts.filter((item) =>
              (item.category || "").toLowerCase().includes("whatsapp")
            );
            const addressContacts = content.contacts.filter((item) =>
              (item.category || "").toLowerCase().includes("alamat") ||
              (item.category || "").toLowerCase().includes("address")
            );
            const emailContacts = content.contacts.filter((item) =>
              (item.category || "").toLowerCase().includes("email")
            );
            const otherContacts = content.contacts.filter((item) =>
              !whatsappContacts.includes(item) && !addressContacts.includes(item) && !emailContacts.includes(item)
            );

            const createContactCard = (category, icon, items, actionLabel) => {
              const card = window.document.createElement("div");
              card.className = "card";
              if (category === "Email") card.classList.add("email-card");
              const heading = window.document.createElement("h3");
              heading.textContent = `${icon} ${category}`;
              const bodyElement = window.document.createElement("div");
              bodyElement.className = "contact-card-body";
              items.forEach((item, index) => {
                const link = window.document.createElement("a");
                link.className = "contact-row";
                let href = item.url || "";
                if (category === "Email") {
                  const emailAddress = (item.url || item.title || item.description || "")
                    .replace(/^mailto:/i, "")
                    .trim();
                  href = emailAddress.includes("@") ? `mailto:${emailAddress}` : "#";
                  link.setAttribute("aria-label", `Kirim email ke ${item.title || item.description || emailAddress}`);
                } else if (category === "Alamat Kantor Pusat") {
                  href = item.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.description || item.title || "")}`;
                } else {
                  href = item.url || "#";
                }
                link.href = href;
                link.target = category === "Email" ? "_self" : "_blank";
                link.rel = "noopener";
                link.textContent = category === "Alamat Kantor Pusat"
                  ? (item.description || item.title || "")
                  : (item.title || item.description || "");
                bodyElement.appendChild(link);
              });
              card.append(heading, bodyElement);
              if (actionLabel && items[0]) {
                const action = window.document.createElement("a");
                action.className = category === "Email" ? "map-btn email-btn" : "map-btn";
                if (category === "Email") {
                  const emailAddress = (items[0].url || items[0].title || items[0].description || "")
                    .replace(/^mailto:/i, "")
                    .trim();
                  action.href = emailAddress.includes("@") ? `mailto:${emailAddress}` : "#";
                  action.setAttribute("aria-label", "Kirim email ke Kurma Travel");
                } else {
                  action.href = items[0].url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(items[0].description || items[0].title || "")}`;
                }
                action.target = category === "Email" ? "_self" : "_blank";
                action.rel = "noopener";
                action.textContent = actionLabel;
                card.appendChild(action);
              }
              grid?.appendChild(card);
            };

            if (whatsappContacts.length) createContactCard("WhatsApp", "📱", whatsappContacts);
            if (addressContacts.length) createContactCard("Alamat Kantor Pusat", "📍", addressContacts, "📍 Buka Maps");
            if (emailContacts.length) createContactCard("Email", "✉️", emailContacts, "✉️ Kirim Email");
            otherContacts.forEach((item) => createContactCard(item.category || "Kontak", "📞", [item]));
          }

          if (location.pathname === "/artikel" || location.pathname === "/artikel.html") {
            const articleList = body.querySelectorAll(".artikel-list")[0];
            const infoList = body.querySelectorAll(".artikel-list")[1];
            articleList?.querySelectorAll(":scope > a").forEach((link) => link.remove());
            infoList?.querySelectorAll(":scope > a").forEach((link) => link.remove());
            content.articles.forEach((item) => {
              const link = window.document.createElement("a");
              link.href = item.url || "#";
              link.textContent = item.title || "Artikel baru";
              link.className = "artikel-link";
              link.addEventListener("click", (event) => {
                if (!item.url?.startsWith("http")) {
                  event.preventDefault();
                  navigate(item.url?.replace(/^\//, "/"));
                }
              });
              if (item.description) link.title = item.description;
              articleList?.appendChild(link);
            });
            content.information.forEach((item) => {
              const link = window.document.createElement("a");
              link.href = item.url || "#";
              link.textContent = item.title || "Informasi baru";
              link.className = "artikel-link";
              link.addEventListener("click", (event) => {
                if (!item.url?.startsWith("http")) {
                  event.preventDefault();
                  navigate(item.url?.replace(/^\//, "/"));
                }
              });
              if (item.description) link.title = item.description;
              infoList?.appendChild(link);
            });
          }

          const detailItems = [...content.articles, ...content.information];
          const detailItem = detailItems.find((item) => {
            const itemRoute = (item.url || "").replace(/\/$/, "").replace(/\.html$/, "").replace(/^\/+/, "/");
            const currentRoute = location.pathname.replace(/\/$/, "").replace(/\.html$/, "");
            return itemRoute === currentRoute || itemRoute === location.pathname;
          });
          const articleInformationRoutes = new Set([
            "/artikel-haji", "/artikel-manfaat", "/artikel-tips",
            "/tentang", "/syarat", "/keunggulan", "/perlengkapan",
            "/artikel-haji.html", "/artikel-manfaat.html", "/artikel-tips.html",
            "/tentang.html", "/syarat.html", "/keunggulan.html", "/perlengkapan.html",
          ]);
          if (
            articleInformationRoutes.has(location.pathname) &&
            !detailItem &&
            location.pathname !== "/perlengkapan" &&
            !location.pathname.endsWith("perlengkapan.html")
          ) {
            navigate("/artikel", { replace: true });
            return;
          }
          if (detailItem?.description) {
            const contentCard = body.querySelector(".content");
            const heroTitle = body.querySelector(".hero h1");
            if (heroTitle && detailItem.title) heroTitle.textContent = detailItem.title;
            if (contentCard) {
              const backButton = contentCard.querySelector(".back")?.cloneNode(true);
              const originalGallery = contentCard.querySelector(".gallery-grid")?.cloneNode(true);
              contentCard.innerHTML = detailItem.description;

              if (originalGallery && !contentCard.querySelector(".gallery-grid")) {
                contentCard.prepend(originalGallery);
              }
              if (backButton) contentCard.appendChild(backButton);

              if (backButton) {
                backButton.addEventListener("click", (event) => {
                  event.preventDefault();
                  navigate("/artikel");
                });
              }
            }
          }
        })
        .catch(() => {});

      body.querySelectorAll("script").forEach((originalScript) => {
        originalScript.remove();
      });

      return () => {
        cleanup.forEach((fn) => fn());
        styleCleanup.forEach((fn) => fn());
      };
    }
  }, [html, pageStyles, location.pathname, navigate]);

  if (error) return <main className="legacy-error">{error}</main>;
  return <div className="legacy-page" dangerouslySetInnerHTML={{ __html: html }} />;
}

window.openWA = function (message) {
  const modal = document.querySelector("#waModal");
  if (!modal) return;

  const numbers = ["6281280803429", "6283875613645", "6287776042572"];
  const encoded = encodeURIComponent(message || "Halo Kurma Travel, saya mau konsultasi");
  ["wa1", "wa2", "wa3"].forEach((id, index) => {
    const link = modal.querySelector(`#${id}`);
    if (link) link.href = `https://wa.me/${numbers[index]}?text=${encoded}`;
  });
  modal.classList.add("active");
  modal.classList.add("show");
  modal.style.display = "flex";
};

window.closeWA = function () {
  const modal = document.querySelector("#waModal");
  modal?.classList.remove("active");
  modal?.classList.remove("show");
  if (modal) modal.style.display = "none";
};

window.openLightbox = function (source) {
  let lightbox = document.querySelector("#lightbox");
  if (!lightbox) {
    lightbox = document.createElement("div");
    lightbox.id = "lightbox";
    lightbox.className = "lightbox";
    lightbox.innerHTML = '<button type="button" class="lightbox-close" aria-label="Tutup foto">&times;</button><button type="button" class="lightbox-nav lightbox-prev" aria-label="Foto sebelumnya">&#10094;</button><img id="lightbox-img" src="" alt="Foto dokumentasi Kurma Travel"><button type="button" class="lightbox-nav lightbox-next" aria-label="Foto berikutnya">&#10095;</button>';
    document.body.appendChild(lightbox);
  }

  let previous = lightbox.querySelector(".lightbox-prev");
  let next = lightbox.querySelector(".lightbox-next");
  if (!previous) {
    previous = document.createElement("button");
    previous.type = "button";
    previous.className = "lightbox-nav lightbox-prev";
    previous.innerHTML = "&#10094;";
    lightbox.appendChild(previous);
  }
  if (!next) {
    next = document.createElement("button");
    next.type = "button";
    next.className = "lightbox-nav lightbox-next";
    next.innerHTML = "&#10095;";
    lightbox.appendChild(next);
  }

  const images = window.galleryImages?.length
    ? window.galleryImages
    : Array.from(document.querySelectorAll(".gallery-grid img")).map((image) => image.src).filter(Boolean);
  const normalizedSource = (() => {
    try {
      return new URL(source, window.location.origin).pathname;
    } catch {
      return String(source || "");
    }
  })();
  let currentIndex = images.findIndex((imageSource) => {
    try {
      return new URL(imageSource, window.location.origin).pathname === normalizedSource;
    } catch {
      return imageSource === source;
    }
  });
  currentIndex = currentIndex >= 0 ? currentIndex : 0;

  const showImage = () => {
    const image = lightbox.querySelector("#lightbox-img");
    if (image && images[currentIndex]) image.src = images[currentIndex];
    lightbox.style.display = "flex";
    lightbox.classList.add("show");
    document.body.style.overflow = "hidden";
  };
  const closeLightbox = () => {
    lightbox.style.display = "none";
    lightbox.classList.remove("show");
    document.body.style.overflow = "";
    if (lightbox._escapeHandler) {
      document.removeEventListener("keydown", lightbox._escapeHandler);
      lightbox._escapeHandler = null;
    }
  };

  previous.onclick = (event) => {
    event.stopPropagation();
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    showImage();
  };
  next.onclick = (event) => {
    event.stopPropagation();
    currentIndex = (currentIndex + 1) % images.length;
    showImage();
  };
  lightbox.querySelector(".lightbox-close").onclick = (event) => {
    event.stopPropagation();
    closeLightbox();
  };
  lightbox.onclick = (event) => {
    if (event.target === lightbox) closeLightbox();
  };
  const escapeHandler = (event) => {
    if (event.key === "Escape") closeLightbox();
  };
  document.removeEventListener("keydown", lightbox._escapeHandler);
  lightbox._escapeHandler = escapeHandler;
  document.addEventListener("keydown", escapeHandler);
  showImage();
};

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((response) => {
        if (response.ok) navigate("/admin", { replace: true });
      })
      .catch(() => {});
  }, [navigate]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "Login gagal");
      return;
    }
    navigate("/admin");
  }

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-brand">
          <img src="/static/images/logo.png" alt="Kurma Travel" />
          <span>KURMA TRAVEL</span>
        </div>
        <h1>Login Admin</h1>
        <p>Kelola paket, galeri, artikel, dan informasi website.</p>
        <label>Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        {error && <div className="admin-error">{error}</div>}
        <button className="admin-primary-button" type="submit" disabled={loading}>
          {loading ? "Memproses..." : "Masuk"}
        </button>
        <button className="admin-back-button" type="button" onClick={() => navigate("/")}>
          Kembali ke website
        </button>
      </form>
    </main>
  );
}

const contentLabels = {
  packages: "Paket",
  gallery: "Galeri",
  articles: "Artikel",
  information: "Informasi",
  staff: "Staf",
  contacts: "Kontak",
};

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("packages");
  const [content, setContent] = useState(defaultContent());
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [galleryView, setGalleryView] = useState("active");
  const [savingStaffOrder, setSavingStaffOrder] = useState(false);
  const [staffOrderDirty, setStaffOrderDirty] = useState(false);
  const editorPanelRef = useRef(null);

  function defaultContent() {
    return { packages: [], gallery: [], articles: [], information: [], staff: [], contacts: [], theme: {} };
  }

  async function loadContent() {
    const sessionResponse = await fetch("/api/admin/session");
    if (sessionResponse.status === 401) {
      navigate("/admin/login", { replace: true });
      return;
    }
    const contentResponse = await fetch("/api/content");
    if (contentResponse.ok) {
      setContent(await contentResponse.json());
      setStaffOrderDirty(false);
    }
  }

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    if (editing === null) return;
    window.requestAnimationFrame(() => {
      editorPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [editing, activeSection]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    navigate("/admin/login", { replace: true });
  }

  async function uploadImage(event, setImage) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/admin/upload", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Upload gagal");
      return;
    }
    setImage(data.url);
  }

  async function saveItem(item) {
    const normalizedItem = { ...item };
    if (activeSection === "staff" && normalizedItem.display_order == null) {
      normalizedItem.display_order = Math.max(
        -1,
        ...orderedStaff(content.staff).map((staffMember, index) =>
          Number.isFinite(Number(staffMember.display_order))
            ? Number(staffMember.display_order)
            : index
        )
      ) + 1;
    }
    if (activeSection === "articles" || activeSection === "information") {
      if (!normalizedItem.url?.trim()) {
        const slugBase = (normalizedItem.title || (activeSection === "articles" ? "artikel-baru" : "informasi-baru"))
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        normalizedItem.url = `/${slugBase || (activeSection === "articles" ? "artikel-baru" : "informasi-baru")}`;
      } else {
        normalizedItem.url = normalizedItem.url.trim().replace(/\.html$/, "");
        if (!normalizedItem.url.startsWith("/") && !/^https?:\/\//i.test(normalizedItem.url)) {
          normalizedItem.url = "/" + normalizedItem.url;
        }
      }
    }
    const method = item.id ? "PUT" : "POST";
    const url = item.id
      ? `/api/admin/content/${activeSection}/${item.id}`
      : `/api/admin/content/${activeSection}`;
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedItem),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error || "Gagal menyimpan konten");
      return;
    }
    setEditing(null);
    setMessage("Konten berhasil disimpan.");
    await loadContent();
  }

  async function moveStaff(index, offset) {
    const allStaff = orderedStaff(content.staff);
    const directors = allStaff.filter((item) =>
      /direktur/i.test(`${item.category || ""} ${item.title || ""}`)
    );
    const reordered = allStaff.filter((item) =>
      !/direktur/i.test(`${item.category || ""} ${item.title || ""}`)
    );
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= reordered.length || savingStaffOrder) return;
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const reorderedItems = [
      ...directors,
      ...reordered,
    ].map((item, order) => ({ ...item, display_order: order }));
    setContent((current) => ({ ...current, staff: reorderedItems }));
    setStaffOrderDirty(true);
  }

  function moveStaffTo(staffId, targetIndex) {
    const allStaff = orderedStaff(content.staff);
    const directors = allStaff.filter((item) =>
      /direktur/i.test(`${item.category || ""} ${item.title || ""}`)
    );
    const reordered = allStaff.filter((item) =>
      !/direktur/i.test(`${item.category || ""} ${item.title || ""}`)
    );
    const sourceIndex = reordered.findIndex((item) => item.id === staffId);
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= reordered.length || sourceIndex === targetIndex) return;
    const [dragged] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, dragged);
    const reorderedItems = [...directors, ...reordered]
      .map((item, order) => ({ ...item, display_order: order }));
    setContent((current) => ({ ...current, staff: reorderedItems }));
    setStaffOrderDirty(true);
  }

  async function saveStaffOrder() {
    if (!staffOrderDirty || savingStaffOrder) return;
    setSavingStaffOrder(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/staff/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: orderedStaff(content.staff).map((item) => item.id) }),
      });
      if (response.status === 405) {
        const reorderedItems = orderedStaff(content.staff);
        const responses = await Promise.all(reorderedItems.map((item) =>
          fetch(`/api/admin/content/staff/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          })
        ));
        const failedResponse = responses.find((itemResponse) => !itemResponse.ok);
        if (failedResponse) {
          const result = await failedResponse.json().catch(() => ({}));
          throw new Error(result.error || "Urutan staf gagal disimpan.");
        }
        await loadContent();
        setMessage("Urutan staf berhasil disimpan.");
        return;
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Urutan staf gagal disimpan.");
      await loadContent();
      setMessage("Urutan staf berhasil disimpan.");
    } catch (error) {
      setMessage(error.message || "Urutan staf gagal disimpan.");
    } finally {
      setSavingStaffOrder(false);
    }
  }

  async function deleteItem(itemId) {
    if (!window.confirm("Hapus konten ini?")) return;
    const response = await fetch(`/api/admin/content/${activeSection}/${itemId}`, { method: "DELETE" });
    if (!response.ok) return;
    await loadContent();
    setMessage("Konten berhasil dihapus.");
  }

  async function toggleGalleryVisibility(item) {
    const hidden = item.hidden ? false : true;
    const response = await fetch(`/api/admin/content/gallery/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, hidden }),
    });
    if (!response.ok) return;
    await loadContent();
    setMessage(hidden ? "Foto berhasil disembunyikan." : "Foto kembali ditampilkan.");
  }

  async function restoreGalleryItem(itemId) {
    const response = await fetch(`/api/admin/gallery/${itemId}/restore`, { method: "POST" });
    if (!response.ok) return;
    await loadContent();
    setMessage("Foto berhasil dipulihkan.");
  }

  async function permanentlyDeleteGalleryItem(itemId) {
    if (!window.confirm("Hapus foto ini secara permanen? Tindakan ini tidak dapat dibatalkan.")) return;
    const response = await fetch(`/api/admin/gallery/${itemId}/permanent`, { method: "DELETE" });
    if (!response.ok) return;
    await loadContent();
    setMessage("Foto berhasil dihapus permanen.");
  }

  async function saveTheme(theme) {
    const response = await fetch("/api/admin/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(theme),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error || "Gagal menyimpan warna");
      return;
    }
    const savedTheme = await response.json();
    setContent((current) => ({ ...current, theme: savedTheme }));
    setMessage("Tema warna berhasil disimpan.");
  }

  const currentItems = activeSection === "staff"
    ? orderedStaff(content.staff)
    : (content[activeSection] || []);
  const whatsappItems = activeSection === "contacts"
    ? currentItems.filter((item) => (item.category || "").toLowerCase().includes("whatsapp"))
    : [];
  const regularItems = activeSection === "contacts"
    ? currentItems.filter((item) => !(item.category || "").toLowerCase().includes("whatsapp"))
    : currentItems;
  const galleryTrashItems = content.gallery_trash || [];

  return (
    <main className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <img src="/static/images/logo.png" alt="Kurma Travel" />
          <strong>KURMA TRAVEL</strong>
        </div>
        <nav>
          {Object.entries(contentLabels).map(([section, label]) => (
            <button
              key={section}
              className={activeSection === section ? "active" : ""}
              onClick={() => { setActiveSection(section); setGalleryView("active"); setEditing(null); setMessage(""); }}
            >
              {label}
            </button>
          ))}
          <button
            className={activeSection === "theme" ? "active" : ""}
            onClick={() => { setActiveSection("theme"); setEditing(null); setMessage(""); }}
          >
            Warna Situs
          </button>
        </nav>
        <button className="admin-logout" onClick={logout}>Keluar</button>
      </aside>

      <section className="admin-content">
        <header className="admin-header">
          <div>
            <span>Admin Panel</span>
            <h1>{activeSection === "theme" ? "Pengaturan Warna Situs" : `Kelola ${contentLabels[activeSection]}`}</h1>
          </div>
          <div className="admin-header-actions">
            <a className="admin-view-button" href="/">Lihat Website</a>
            {activeSection !== "theme" && !(activeSection === "gallery" && galleryView === "trash") && (
              <button className="admin-primary-button" onClick={() => setEditing({})}>
                {activeSection === "contacts" ? "Tambah Kontak Lain" : `Tambah ${contentLabels[activeSection]}`}
              </button>
            )}
          </div>
        </header>
        {message && <div className="admin-message">{message}</div>}

        {activeSection === "gallery" && (
          <div className="gallery-admin-toolbar">
            <button
              type="button"
              className={galleryView === "active" ? "active" : ""}
              onClick={() => { setGalleryView("active"); setEditing(null); }}
            >
              Galeri Aktif
            </button>
            <button
              type="button"
              className={galleryView === "trash" ? "active" : ""}
              onClick={() => { setGalleryView("trash"); setEditing(null); }}
            >
              Sampah ({galleryTrashItems.length})
            </button>
          </div>
        )}

        {activeSection === "theme" && (
          <ThemeEditor theme={content.theme || {}} onSave={saveTheme} />
        )}

        {editing !== null && (
          <div className="admin-editor-panel" ref={editorPanelRef}>
            <ContentEditor
              key={`${activeSection}-${editing.id || "new"}`}
              section={activeSection}
              item={editing}
              onSave={saveItem}
              onCancel={() => setEditing(null)}
              onUpload={uploadImage}
            />
          </div>
        )}

        {activeSection === "staff" && (
          <div className="admin-staff-order-toolbar">
            <p className="admin-staff-order-hint">
              Seret kartu staf untuk menyusun urutannya, atau gunakan tombol panah. Direktur tetap berada di bagian utama.
            </p>
            {staffOrderDirty && (
              <button
                type="button"
                className="admin-primary-button"
                disabled={savingStaffOrder}
                onClick={saveStaffOrder}
              >
                {savingStaffOrder ? "Menyimpan..." : "Simpan Urutan"}
              </button>
            )}
          </div>
        )}

        {activeSection !== "theme" && galleryView === "trash" && activeSection === "gallery" && (
          <div className="admin-list admin-list-gallery-trash">
            {galleryTrashItems.length === 0 && <div className="admin-empty">Sampah galeri kosong.</div>}
            {galleryTrashItems.map((item) => (
              <article className="admin-list-item" key={item.id}>
                {item.image && <img className="admin-list-image" src={item.image} alt="" />}
                <div>
                  <strong>{item.title || "Foto galeri"}</strong>
                  <small>{item.deleted_at ? `Dipindahkan ${item.deleted_at.replace("T", " ")}` : "Ada di sampah"}</small>
                </div>
                <div className="admin-item-actions">
                  <button onClick={() => restoreGalleryItem(item.id)}>Pulihkan</button>
                  <button className="danger" onClick={() => permanentlyDeleteGalleryItem(item.id)}>Hapus Permanen</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {activeSection === "contacts" && whatsappItems.length > 0 && (
          <section className="admin-contact-group">
            <header>
              <div>
                <h2>WhatsApp</h2>
                <p>{whatsappItems.length} nomor, dikelola dalam satu daftar seperti tampilan publik.</p>
              </div>
              <button type="button" className="admin-primary-button" onClick={() => setEditing({ category: "WhatsApp" })}>
                Tambah Nomor
              </button>
            </header>
            <div className="admin-contact-table-wrap">
              <table className="admin-contact-table">
                <thead>
                  <tr><th>Nama / Nomor</th><th>Link WhatsApp</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {whatsappItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title || "Nomor WhatsApp"}</td>
                      <td><a href={item.url} target="_blank" rel="noopener noreferrer">{item.url || "Belum ada link"}</a></td>
                      <td>
                        <div className="admin-item-actions">
                          <button type="button" onClick={() => setEditing(item)}>Edit</button>
                          <button type="button" className="danger" onClick={() => deleteItem(item.id)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection !== "theme" && !(activeSection === "gallery" && galleryView === "trash") && <div className={`admin-list admin-list-${activeSection}`}>
          {regularItems.length === 0 && !(activeSection === "contacts" && whatsappItems.length > 0) && <div className="admin-empty">Belum ada data.</div>}
          {regularItems.map((item) => {
            const isDirector = /direktur/i.test(`${item.category || ""} ${item.title || ""}`);
            const staffMembers = currentItems.filter((staffMember) =>
              !/direktur/i.test(`${staffMember.category || ""} ${staffMember.title || ""}`)
            );
            const staffOrderIndex = activeSection === "staff" && !isDirector
              ? staffMembers.findIndex((staffMember) => staffMember.id === item.id)
              : -1;
            return (
            <article
              className={`admin-list-item ${activeSection === "staff" && !isDirector ? "admin-staff-sortable" : ""}`}
              key={item.id}
              draggable={activeSection === "staff" && !isDirector}
              onDragStart={(event) => {
                if (activeSection !== "staff" || isDirector) return;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.id);
              }}
              onDragOver={(event) => {
                if (activeSection === "staff" && !isDirector) event.preventDefault();
              }}
              onDrop={(event) => {
                if (activeSection !== "staff" || isDirector) return;
                event.preventDefault();
                moveStaffTo(event.dataTransfer.getData("text/plain"), staffOrderIndex);
              }}
            >
              {item.image && <img className="admin-list-image" src={item.image} alt="" />}
              <div>
                <strong>{item.title || "Tanpa judul"}</strong>
                {activeSection === "gallery" && (
                  <p><span className={`gallery-status ${item.hidden ? "hidden" : ""}`}>{item.hidden ? "Tersembunyi" : "Ditampilkan"}</span></p>
                )}
                {(item.category || item.description) && (
                  <p>{item.category ? `${item.category} - ` : ""}{
                    activeSection === "articles" || activeSection === "information"
                      ? stripHtml(item.description).slice(0, 180) || "Belum ada isi konten."
                      : item.description || ""
                  }</p>
                )}
                {item.url && <small>{item.url}</small>}
              </div>
              <div className="admin-item-actions">
                {activeSection === "staff" && !isDirector && (
                  <div className="admin-staff-order">
                    <span>Urutan {staffOrderIndex + 1}</span>
                    <button
                      type="button"
                      aria-label={`Naikkan ${item.title}`}
                      disabled={savingStaffOrder || staffOrderIndex === 0}
                      onClick={() => moveStaff(staffOrderIndex, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Turunkan ${item.title}`}
                      disabled={savingStaffOrder || staffOrderIndex === staffMembers.length - 1}
                      onClick={() => moveStaff(staffOrderIndex, 1)}
                    >
                      ↓
                    </button>
                  </div>
                )}
                {activeSection === "gallery" && (
                  <button onClick={() => toggleGalleryVisibility(item)}>
                    {item.hidden ? "Tampilkan" : "Sembunyikan"}
                  </button>
                )}
                <button onClick={() => setEditing(item)}>Edit</button>
                <button className="danger" onClick={() => deleteItem(item.id)}>Hapus</button>
              </div>
            </article>
          ); })}
        </div>}
      </section>
    </main>
  );
}

function stripHtml(value) {
  if (!value) return "";
  const document = new DOMParser().parseFromString(String(value), "text/html");
  return (document.body.textContent || "").replace(/\s+/g, " ").trim();
}

function orderedStaff(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftOrder = Number.isFinite(Number(left.item.display_order))
        ? Number(left.item.display_order)
        : left.index;
      const rightOrder = Number.isFinite(Number(right.item.display_order))
        ? Number(right.item.display_order)
        : right.index;
      return leftOrder - rightOrder || left.index - right.index;
    })
    .map(({ item }) => item);
}

function escapeHtml(value) {
  const element = window.document.createElement("span");
  element.textContent = String(value || "");
  return element.innerHTML;
}

function descriptionToBlocks(description) {
  if (!description) return [{ type: "paragraph", text: "" }];
  const document = new DOMParser().parseFromString(description, "text/html");
  const blocks = [];
  Array.from(document.body.children).forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === "h2" || tag === "h3") {
      blocks.push({ type: "heading", level: tag, text: element.textContent.trim() });
    } else if (tag === "p") {
      blocks.push({ type: "paragraph", text: element.textContent.trim() });
    } else if (tag === "ul" || tag === "ol") {
      blocks.push({
        type: "list",
        ordered: tag === "ol",
        className: element.className || "",
        items: Array.from(element.children).map((item) => {
          const clone = item.cloneNode(true);
          clone.querySelectorAll("br").forEach((br) => br.replaceWith(window.document.createTextNode("\n")));
          clone.querySelectorAll("strong, b").forEach((strong) => {
            strong.replaceWith(window.document.createTextNode(`${strong.textContent.trim()}\n`));
          });
          return (clone.textContent || "").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{2,}/g, "\n").trim();
        }).filter(Boolean),
      });
    } else if (tag === "div" && element.classList.contains("gallery-grid")) {
      // Perlengkapan photos remain controlled by the original page layout.
    }
  });
  return blocks.length ? blocks : [{ type: "paragraph", text: stripHtml(description) }];
}

function blocksToHtml(blocks) {
  return blocks.map((block) => {
    if (block.type === "heading") {
      const tag = block.level === "h3" ? "h3" : "h2";
      return `<${tag}>${escapeHtml(block.text)}</${tag}>`;
    }
    if (block.type === "list") {
      const tag = block.ordered ? "ol" : "ul";
      const className = block.className ? ` class="${escapeHtml(block.className).replace(/&quot;/g, "")}"` : "";
      const items = (block.items || []).map((item) => {
        const normalized = String(item || "").replace(/\r\n?/g, "\n").trim();
        if (!normalized) return "";
        const newlineIndex = normalized.indexOf("\n");
        if (newlineIndex >= 0) {
          const title = normalized.slice(0, newlineIndex).trim();
          const description = normalized.slice(newlineIndex + 1).trim();
          return `<li><strong>${escapeHtml(title)}</strong>${description ? `<br>${escapeHtml(description)}` : ""}</li>`;
        }
        return `<li>${escapeHtml(normalized)}</li>`;
      }).join("");
      return `<${tag}${className}>${items}</${tag}>`;
    }
    return block.text ? `<p>${escapeHtml(block.text)}</p>` : "";
  }).join("\n");
}

const LEGACY_EQUIPMENT_TEXT = "Dengan perlengkapan eksklusif dari Kurma Travel, setiap jamaah mendapatkan fasilitas yang dirancang untuk menunjang kenyamanan dan kekhusyukan selama menjalankan ibadah Umroh maupun Haji. Mulai dari koper berkualitas, tas serbaguna, kain ihram, hingga perlengkapan pendukung lainnya, semuanya dipersiapkan dengan standar terbaik agar perjalanan ibadah Anda lebih praktis, aman, dan terorganisir dengan baik.";

function getEquipmentTextBlocks(item) {
  if (Array.isArray(item?.equipment_text_blocks) && item.equipment_text_blocks.length) {
    return item.equipment_text_blocks.map((block) => ({ ...block }));
  }
  const parsed = descriptionToBlocks(item?.description);
  const usable = parsed.filter((block) =>
    block.type === "list"
      ? (block.items || []).some((text) => String(text || "").trim())
      : String(block.text || "").trim()
  );
  return usable.length ? usable.map((block) => ({ ...block })) : [
    { type: "paragraph", text: LEGACY_EQUIPMENT_TEXT },
  ];
}

function ThemeEditor({ theme, onSave }) {
  const [form, setForm] = useState({
    primary: theme.primary || "#e87824",
    primary_dark: theme.primary_dark || "#bd5416",
    navbar: theme.navbar || "#f18b3c",
    green: theme.green || "#244b3a",
    green_dark: theme.green_dark || "#173528",
    background: theme.background || "#fffdf9",
  });

  useEffect(() => {
    setForm({
      primary: theme.primary || "#e87824",
      primary_dark: theme.primary_dark || "#bd5416",
      navbar: theme.navbar || "#f18b3c",
      green: theme.green || "#244b3a",
      green_dark: theme.green_dark || "#173528",
      background: theme.background || "#fffdf9",
    });
  }, [theme]);

  const fields = [
    ["primary", "Warna Utama"],
    ["primary_dark", "Warna Utama Gelap"],
    ["navbar", "Warna Navbar/Header"],
    ["green", "Warna Hijau"],
    ["green_dark", "Warna Hijau Gelap"],
    ["background", "Warna Latar"],
  ];

  return (
    <form className="admin-editor theme-editor" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
      <h2>Atur Warna Tampilan Website</h2>
      <div className="theme-color-grid">
        {fields.map(([key, label]) => (
          <label key={key}>
            {label}
            <span className="theme-color-control">
              <input
                type="color"
                value={form[key]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              />
              <input
                type="text"
                value={form[key]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              />
            </span>
          </label>
        ))}
      </div>
      <div className="admin-editor-actions">
        <button className="admin-primary-button" type="submit">Simpan Warna</button>
      </div>
    </form>
  );
}

function ContentEditor({ section, item, onSave, onCancel, onUpload }) {
  const isEquipmentInformation = section === "information" &&
    (String(item.url || "").replace(/\/+$/, "").replace(/\.html$/, "") === "/perlengkapan" ||
      /perlengkapan/i.test(item.title || ""));
  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    image: "",
    url: "",
    badge: "",
    program: "",
    period: "",
    duration: "",
    price: "",
    detail: "",
    ...item,
  });
  const [contentBlocks, setContentBlocks] = useState(
    section === "articles" || section === "information"
      ? (isEquipmentInformation
        ? getEquipmentTextBlocks(item)
        : descriptionToBlocks(item.description))
      : []
  );
  const [equipmentImages, setEquipmentImages] = useState(
    isEquipmentInformation
      ? (Array.isArray(item.equipment_images) && item.equipment_images.length
        ? [...item.equipment_images]
        : Array.from({ length: 11 }, (_, index) => `/static/images/perlengkapan/perlengkapan${index + 1}.jpg`))
      : []
  );
  const [equipmentFeatures, setEquipmentFeatures] = useState(
    isEquipmentInformation && Array.isArray(item.equipment_features)
      ? item.equipment_features.map((feature) => ({ ...feature }))
      : []
  );
  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateBlock(index, patch) {
    setContentBlocks((current) => current.map((block, blockIndex) =>
      blockIndex === index ? { ...block, ...patch } : block
    ));
  }

  function addBlock(type) {
    const block = type === "heading"
      ? { type, level: "h2", text: "" }
      : type === "list"
      ? { type, ordered: false, items: [""], className: "" }
      : { type: "paragraph", text: "" };
    setContentBlocks((current) => [...current, block]);
  }

  return (
    <form className="admin-editor" onSubmit={(event) => {
      event.preventDefault();
      onSave({
        ...form,
        ...(section === "articles" || section === "information"
          ? { description: blocksToHtml(contentBlocks) }
          : {}),
        ...(isEquipmentInformation ? {
          equipment_images: equipmentImages.filter(Boolean),
          equipment_features: equipmentFeatures.filter((feature) => String(feature.title || "").trim()),
          equipment_text_blocks: contentBlocks.filter((block) =>
            block.type === "list"
              ? (block.items || []).some((text) => String(text || "").trim())
              : String(block.text || "").trim()
          ),
        } : {}),
      });
    }}>
      <h2>{item.id ? "Edit konten" : "Tambah konten"}</h2>
      <div className="admin-form-grid">
        <label>Judul
          <input value={form.title} onChange={(event) => update("title", event.target.value)} required />
        </label>
        {(section === "packages" || section === "gallery" || section === "staff" || section === "contacts") && (
          <label>{section === "packages" ? "Kategori" : section === "contacts" ? "Jenis Kontak" : "Gambar / Foto"}
            {section === "packages"
              ? <input value={form.category} onChange={(event) => update("category", event.target.value)} />
              : section === "contacts"
              ? <input value={form.category} onChange={(event) => update("category", event.target.value)} placeholder="WhatsApp, Alamat, atau Email" />
              : (
                <>
                  <input value={form.image} onChange={(event) => update("image", event.target.value)} placeholder="/static/uploads/..." />
                  <input className="admin-file-input" type="file" accept="image/*" onChange={(event) => onUpload(event, (url) => update("image", url))} />
                </>
              )}
          </label>
        )}
        {(section === "packages" || section === "articles" || section === "information" || section === "contacts") && (
          section === "articles" || section === "information"
            ? (
              <div className="admin-full-field admin-content-blocks">
                <div className="admin-content-blocks-header">
                  <strong>{section === "articles" ? "Isi Artikel" : isEquipmentInformation ? "Isi Paragraf Perlengkapan" : "Isi Informasi"}</strong>
                  <span>Gunakan blok seperti tampilan website, tanpa menulis HTML.</span>
                </div>
                {contentBlocks.map((block, index) => (
                  <div className="admin-content-block" key={`${block.type}-${index}`}>
                    <div className="admin-block-head">
                      <span>{block.type === "heading" ? "Judul Bagian" : block.type === "list" ? "Daftar Poin" : "Paragraf"}</span>
                      <div className="admin-block-head-actions">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => setContentBlocks((current) => {
                            const next = [...current];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            return next;
                          })}
                        >
                          Naik
                        </button>
                        <button
                          type="button"
                          disabled={index === contentBlocks.length - 1}
                          onClick={() => setContentBlocks((current) => {
                            const next = [...current];
                            [next[index + 1], next[index]] = [next[index], next[index + 1]];
                            return next;
                          })}
                        >
                          Turun
                        </button>
                        <button type="button" className="danger" onClick={() => setContentBlocks((current) => current.filter((_, i) => i !== index))}>Hapus Blok</button>
                      </div>
                    </div>
                    {block.type === "heading" && (
                      <>
                        <select value={block.level} onChange={(event) => updateBlock(index, { level: event.target.value })}>
                          <option value="h2">Judul utama bagian (H2)</option>
                          <option value="h3">Judul kecil (H3)</option>
                        </select>
                        <input value={block.text} onChange={(event) => updateBlock(index, { text: event.target.value })} placeholder="Judul bagian" />
                      </>
                    )}
                    {block.type === "paragraph" && (
                      <textarea rows="4" value={block.text} onChange={(event) => updateBlock(index, { text: event.target.value })} placeholder="Tulis isi paragraf..." />
                    )}
                    {block.type === "list" && (
                      <textarea
                        rows="7"
                        value={(block.items || []).join("\n")}
                        onChange={(event) => updateBlock(index, { items: event.target.value.split("\n") })}
                        placeholder={"Tulis satu poin setiap baris:\nPoin pertama\nPoin kedua"}
                      />
                    )}
                  </div>
                ))}
                <div className="admin-block-actions">
                  <button type="button" onClick={() => addBlock("heading")}>+ Judul</button>
                  <button type="button" onClick={() => addBlock("paragraph")}>+ Paragraf</button>
                  <button type="button" onClick={() => addBlock("list")}>+ Daftar Poin</button>
                </div>
              </div>
            )
            : (
              <label>{section === "contacts" ? "Deskripsi" : "Deskripsi"}
                <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows="5" />
              </label>
            )
        )}
        {section === "staff" && (
          <label>Jabatan
            <input value={form.category} onChange={(event) => update("category", event.target.value)} placeholder="Direktur Utama, Staf Admin, Marketing" />
          </label>
        )}
        {isEquipmentInformation && (
          <div className="admin-full-field admin-equipment-manager">
            <div className="admin-equipment-header">
              <strong>Kartu & Fitur Perlengkapan</strong>
              <span>Kelola judul, ikon, dan urutan kartu yang ditampilkan di atas foto perlengkapan.</span>
            </div>
            <div className="admin-equipment-feature-list">
              {equipmentFeatures.map((feature, index) => (
                <div className="admin-equipment-feature-item" key={`feature-${index}`}>
                  <div className="admin-feature-preview" aria-label="Pratinjau kartu">
                    {feature.image
                      ? <img src={feature.image} alt="" />
                      : <span>{feature.icon || "◆"}</span>}
                    <strong>{feature.title || "Judul kartu baru"}</strong>
                  </div>
                  <label>
                    Judul kartu
                    <input
                      value={feature.title || ""}
                      onChange={(event) => setEquipmentFeatures((current) => current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, title: event.target.value } : item
                      ))}
                      placeholder="Contoh: Tali Lanyard Premium"
                    />
                  </label>
                  <label>
                    Ikon
                    <input
                      value={feature.icon || ""}
                      onChange={(event) => setEquipmentFeatures((current) => current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, icon: event.target.value } : item
                      ))}
                      placeholder="Contoh: ✓, ◆, atau emoji"
                    />
                  </label>
                  <label>
                    Gambar ikon (opsional)
                    <input
                      value={feature.image || ""}
                      onChange={(event) => setEquipmentFeatures((current) => current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, image: event.target.value } : item
                      ))}
                      placeholder="/static/uploads/..."
                    />
                    <input
                      className="admin-file-input"
                      type="file"
                      accept="image/*"
                      onChange={(event) => onUpload(event, (url) => setEquipmentFeatures((current) =>
                        current.map((item, itemIndex) => itemIndex === index ? { ...item, image: url } : item
                      )))}
                    />
                  </label>
                  <div className="admin-equipment-actions">
                    <button type="button" disabled={index === 0} onClick={() => setEquipmentFeatures((current) => {
                      const next = [...current];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      return next;
                    })}>Naik</button>
                    <button type="button" disabled={index === equipmentFeatures.length - 1} onClick={() => setEquipmentFeatures((current) => {
                      const next = [...current];
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      return next;
                    })}>Turun</button>
                    <button type="button" className="danger" onClick={() => setEquipmentFeatures((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index)
                    )}>Hapus</button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="admin-equipment-add-feature"
              onClick={() => setEquipmentFeatures((current) => [...current, { title: "", icon: "◆", image: "" }])}
            >
              + Tambah Kartu/Fitur
            </button>

            <div className="admin-equipment-header">
              <strong>Foto Perlengkapan</strong>
              <span>Tambah, ganti urutan, atau hapus foto yang ditampilkan pada halaman Perlengkapan.</span>
            </div>
            <div className="admin-equipment-grid">
              {equipmentImages.map((imageUrl, index) => (
                <div className="admin-equipment-item" key={`${imageUrl}-${index}`}>
                  <img src={imageUrl} alt={`Perlengkapan ${index + 1}`} />
                  <div className="admin-equipment-actions">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => setEquipmentImages((current) => {
                        const next = [...current];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        return next;
                      })}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      disabled={index === equipmentImages.length - 1}
                      onClick={() => setEquipmentImages((current) => {
                        const next = [...current];
                        [next[index + 1], next[index]] = [next[index], next[index + 1]];
                        return next;
                      })}
                    >
                      →
                    </button>
                    <button type="button" className="danger" onClick={() =>
                      setEquipmentImages((current) => current.filter((_, currentIndex) => currentIndex !== index))
                    }>
                      Hapus
                    </button>
                  </div>
                  <label className="admin-equipment-upload">
                    Ganti foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => onUpload(event, (url) => {
                        setEquipmentImages((current) => current.map((itemUrl, itemIndex) =>
                          itemIndex === index ? url : itemUrl
                        ));
                      })}
                    />
                  </label>
                </div>
              ))}
            </div>
            <label className="admin-equipment-add">
              Tambah Foto Perlengkapan
              <input
                type="file"
                accept="image/*"
                onChange={(event) => onUpload(event, (url) => {
                  setEquipmentImages((current) => [...current, url]);
                })}
              />
            </label>
          </div>
        )}
        {(section === "articles" || section === "information" || section === "contacts") && (
          <label className="admin-full-field">Link / URL
            <input value={form.url} onChange={(event) => update("url", event.target.value)} placeholder="artikel.html atau https://..." />
          </label>
        )}
        {section === "packages" && (
          <>
            <label>Tag poster
              <input value={form.badge} onChange={(event) => update("badge", event.target.value)} placeholder="RAMADHAN, UMRAH, atau BEST SELLER" />
            </label>
            <label>Program perjalanan
              <input value={form.program} onChange={(event) => update("program", event.target.value)} placeholder="Perjalanan ibadah Umrah" />
            </label>
            <label>Periode
              <input value={form.period} onChange={(event) => update("period", event.target.value)} placeholder="Periode Ramadhan" />
            </label>
            <label>Durasi
              <input value={form.duration} onChange={(event) => update("duration", event.target.value)} placeholder="Durasi 9 hari" />
            </label>
            <label>Judul informasi harga
              <input value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="Informasi harga" />
            </label>
            <label>Keterangan harga
              <input value={form.detail} onChange={(event) => update("detail", event.target.value)} placeholder="Lihat Detail / Hubungi Kami" />
            </label>
            <label>Poster Paket
              <input value={form.image} onChange={(event) => update("image", event.target.value)} placeholder="/static/uploads/..." />
              <input className="admin-file-input" type="file" accept="image/*,.pdf" onChange={(event) => onUpload(event, (url) => update("image", url))} />
            </label>
          </>
        )}
      </div>
      <div className="admin-editor-actions">
        <button type="button" className="admin-secondary-button" onClick={onCancel}>Batal</button>
        <button type="submit" className="admin-primary-button">Simpan</button>
      </div>
    </form>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<LegacyPage />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
