// ============================================
// SCRIPT.JS - EEAFR
// ============================================
// Parte do frontend ja esta pronta (menu, scroll, abas, contador).
// A integracao com a API do backend esta INCOMPLETA.
//
// O formulario de contato ja funciona com o backend (veja abaixo).
// TODO: Implemente as funcoes para carregar dados do backend
// nas paginas de cursos, eventos, galeria e corpo docente.
// ============================================

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
    const form = document.querySelector(".contato-form form");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            try {
                const response = await fetch("/api/contato", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
                const result = await response.json();
                if (result.erro) {
                    alert("Erro: " + result.mensagem);
                } else {
                    alert("Mensagem enviada com sucesso! Entraremos em contato em breve.");
                    form.reset();
                }
            } catch (error) {
                alert("Erro ao enviar mensagem. Verifique se o servidor esta rodando.");
                console.error("Erro:", error);
            }
        });
    }

    // ============================================
    // TODO: CARREGAR CURSOS DO BACKEND
    // ============================================
    // Na pagina cursos.html, busque os cursos da API
    // e preencha as abas com os dados do banco.
    //
    // Exemplo de como fazer:
    //
    // async function carregarCursos() {
    //     try {
    //         const response = await fetch("/api/cursos");
    //         const result = await response.json();
    //         if (!result.erro) {
    //             console.log("Cursos:", result.dados);
    //             // TODO: Preencher as abas com os dados
    //         }
    //     } catch (error) {
    //         console.error("Erro ao carregar cursos:", error);
    //     }
    // }
    // carregarCursos();

    // ============================================
    // TODO: CARREGAR EVENTOS DO BACKEND
    // ============================================
    // Na pagina eventos.html, busque os eventos da API
    // e preencha as listas com os dados do banco.
    //
    // Exemplo:
    //
    // async function carregarEventos() {
    //     try {
    //         const response = await fetch("/api/eventos");
    //         const result = await response.json();
    //         if (!result.erro) {
    //             console.log("Eventos:", result.dados);
    //             // TODO: Preencher a lista de eventos
    //         }
    //     } catch (error) {
    //         console.error("Erro ao carregar eventos:", error);
    //     }
    // }
    // carregarEventos();

    // ============================================
    // TODO: CARREGAR GALERIA DO BACKEND
    // ============================================
    // Na pagina galeria.html, busque as fotos da API
    // e preencha a galeria com os dados do banco.
    //
    // Exemplo:
    //
    // async function carregarGaleria() {
    //     try {
    //         const response = await fetch("/api/galeria");
    //         const result = await response.json();
    //         if (!result.erro) {
    //             console.log("Fotos:", result.dados);
    //             // TODO: Montar a galeria dinamicamente
    //         }
    //     } catch (error) {
    //         console.error("Erro ao carregar galeria:", error);
    //     }
    // }
    // carregarGaleria();

    // ============================================
    // TODO: CARREGAR PROFESSORES DO BACKEND
    // ============================================
    // Na pagina corpo-docente.html, busque os professores da API
    // e preencha as abas por area com os dados do banco.
    //
    // Exemplo:
    //
    // async function carregarProfessores() {
    //     try {
    //         const response = await fetch("/api/professores");
    //         const result = await response.json();
    //         if (!result.erro) {
    //             console.log("Professores:", result.dados);
    //             // TODO: Preencher as abas por area
    //         }
    //     } catch (error) {
    //         console.error("Erro ao carregar professores:", error);
    //     }
    // }
    // carregarProfessores();

    // ============================================
    // TODO: CARREGAR DADOS DA ESCOLA DO BACKEND
    // ============================================
    // Na pagina secretaria-digital.html, busque os dados da API
    // e preencha os cards com os dados do banco.
    //
    // Exemplo:
    //
    // async function carregarDadosEscola() {
    //     try {
    //         const response = await fetch("/api/escola");
    //         const result = await response.json();
    //         if (!result.erro) {
    //             console.log("Dados da escola:", result.dados);
    //             // TODO: Preencher os cards de dados
    //         }
    //     } catch (error) {
    //         console.error("Erro ao carregar dados:", error);
    //     }
    // }
    // carregarDadosEscola();

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
                            const current = eased * target;

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
        if (menuToggle) menuToggle.classList.remove("active");
        if (navMenu) navMenu.classList.remove("active");
        if (navOverlay) navOverlay.classList.remove("active");
        document.body.style.overflow = "";
    }

    if (menuToggle && navMenu) {
        menuToggle.addEventListener("click", () => {
            const isOpen = navMenu.classList.contains("active");
            if (isOpen) {
                closeMobileMenu();
            } else {
                menuToggle.classList.add("active");
                navMenu.classList.add("active");
                if (navOverlay) navOverlay.classList.add("active");
                document.body.style.overflow = "hidden";
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
