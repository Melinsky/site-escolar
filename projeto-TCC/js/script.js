document.addEventListener("DOMContentLoaded", () => {

    // Botao voltar ao topo
    const backToTopBtn = document.createElement("button");
    backToTopBtn.id = "backToTopBtn";
    backToTopBtn.innerHTML = "&uarr;";
    backToTopBtn.setAttribute("aria-label", "Voltar ao topo");
    document.body.appendChild(backToTopBtn);

    backToTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Header scrolled
    const header = document.querySelector("header");

    window.addEventListener("scroll", () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add("show");
        } else {
            backToTopBtn.classList.remove("show");
        }
        if (header) {
            if (window.scrollY > 50) {
                header.classList.add("scrolled");
            } else {
                header.classList.remove("scrolled");
            }
        }
    });

    // ============================================
    // FORMULARIO DE CONTATO - COM backend
    // Status: COMPLETO - ja envia para /api/contato
    // ============================================
    const form = document.querySelector('.contato-form form');
    if (form) {
        const status = document.createElement('p'); status.setAttribute('role','status'); form.append(status);
        form.addEventListener('submit', async event => {
            event.preventDefault(); const button = form.querySelector('[type="submit"]');
            button.disabled=true; status.textContent='Enviando mensagem…';
            try {
                const response=await fetch('/api/contato',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
                const result=await response.json(); if(!response.ok || result.erro) throw new Error(result.mensagem);
                status.textContent='Mensagem recebida pela secretaria. Protocolo: '+result.dados.id+'.'; form.reset();
            } catch(error) { status.textContent=error.message || 'Não foi possível enviar. Tente novamente.'; }
            finally { button.disabled=false; }
        });
    }

    // Scroll reveal
    const revealElements = document.querySelectorAll(".reveal");
    if (revealElements.length > 0) {
        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("active");
                        revealObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.1 }
        );
        revealElements.forEach((el) => revealObserver.observe(el));
    }

    // Contador animado
    const statNumbers = document.querySelectorAll(".stat-number[data-target]");
    if (statNumbers.length > 0) {
        const counterObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const el = entry.target;
                        const target = parseFloat(el.getAttribute("data-target"));
                        const isDecimal = el.hasAttribute("data-decimal");
                        const duration = 2000;
                        const startTime = performance.now();

                        function updateCounter(currentTime) {
                            const elapsed = currentTime - startTime;
                            const progress = Math.min(elapsed / duration, 1);
                            const eased = 1 - Math.pow(1 - progress, 3);
                            const current = eased * parseFloat(el.getAttribute("data-target"));

                            if (isDecimal) {
                                el.textContent = current.toFixed(1);
                            } else if (target >= 1000) {
                                el.textContent = Math.floor(current).toLocaleString("pt-BR") + "+";
                            } else {
                                el.textContent = Math.floor(current) + "+";
                            }

                            if (progress < 1) {
                                requestAnimationFrame(updateCounter);
                            }
                        }

                        requestAnimationFrame(updateCounter);
                        counterObserver.unobserve(el);
                    }
                });
            },
            { threshold: 0.5 }
        );
        statNumbers.forEach((num) => counterObserver.observe(num));
    }

    // Menu mobile
    const menuToggle = document.querySelector(".mobile-menu-toggle");
    const navMenu = document.querySelector("nav");

    let navOverlay = document.querySelector(".nav-overlay");
    if (!navOverlay && navMenu) {
        navOverlay = document.createElement("div");
        navOverlay.className = "nav-overlay";
        document.body.appendChild(navOverlay);
    }

    function closeMobileMenu() {
        const wasOpen = navMenu?.classList.contains("active");
        if (menuToggle) { menuToggle.classList.remove("active"); menuToggle.setAttribute("aria-expanded","false"); menuToggle.setAttribute("aria-label", "Abrir menu de navegação"); }
        if (navMenu) navMenu.classList.remove("active");
        if (navOverlay) navOverlay.classList.remove("active");
        document.body.style.overflow = "";
        if (wasOpen && matchMedia('(max-width: 768px)').matches) menuToggle?.focus({ preventScroll: true });
    }

    if (menuToggle && navMenu) {
        menuToggle.addEventListener("click", () => {
            const isOpen = navMenu.classList.contains("active");
            if (isOpen) {
                closeMobileMenu();
            } else {
                menuToggle.classList.add("active");
                menuToggle.setAttribute("aria-expanded","true");
                menuToggle.setAttribute("aria-label", "Fechar menu de navegação");
                navMenu.classList.add("active");
                if (navOverlay) navOverlay.classList.add("active");
                document.body.style.overflow = "hidden";
                menuToggle.focus({ preventScroll: true });
            }
        });

        navMenu.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeMobileMenu);
        });

        if (navOverlay) {
            navOverlay.addEventListener("click", closeMobileMenu);
        }

        document.addEventListener("click", (e) => {
            if (!navMenu.contains(e.target) && !menuToggle.contains(e.target) && !navOverlay.contains(e.target)) {
                closeMobileMenu();
            }
        });
    }

    document.addEventListener("keydown", e => { if (e.key === "Escape") closeMobileMenu(); });
    matchMedia('(max-width: 768px)').addEventListener('change', closeMobileMenu);
    document.addEventListener('keydown', event => {
        if (event.key !== 'Tab' || !navMenu?.classList.contains('active')) return;
        const controls = [menuToggle, ...navMenu.querySelectorAll('a[href]')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    // Sistema de abas
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanels = document.querySelectorAll(".tab-panel");

    if (tabBtns.length > 0) {
        tabBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                const targetTab = btn.getAttribute("data-tab");
                tabBtns.forEach((b) => b.classList.remove("active"));
                tabPanels.forEach((p) => p.classList.remove("active"));
                btn.classList.add("active");
                const targetPanel = document.getElementById("tab-" + targetTab);
                if (targetPanel) {
                    targetPanel.classList.add("active");
                }
            });
        });
    }
});
