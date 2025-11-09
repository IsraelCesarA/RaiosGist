// Variáveis Globais do Mapa e Camadas
const map = L.map('map').setView([-3.7678, -38.5365], 12);
let layerGroup = L.layerGroup().addTo(map); 
let sondaMarker = null;
let isSondaActive = false; 

// Variáveis de rastreio
let fixedSondaMarker = null;
let fixedSondaCircle = null; 

// URLs de API
const API_URL = 'http://gistapis.etufor.ce.gov.br:8081/api/postoControle/';
const PLACEHOLDER_LAT = -3.7317; // Lat/Lng de Fortaleza para simulação
const PLACEHOLDER_LNG = -38.5267;

// Inicialização do Mapa
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    maxZoom: 19,
}).addTo(map);

// ****** INÍCIO DA CORREÇÃO ******
// Função para buscar o posto, lendo XML e com aviso de falha (CORS)
async function fetchPosto(numero) {
    try {
        const resp = await fetch(`${API_URL}${numero}`);
        if (!resp.ok) throw new Error(`API indisponível (Erro ${resp.status})`);
        
        // 1. Obter a resposta como TEXTO (pois é XML)
        const xmlString = await resp.text();
        
        // 2. Iniciar o analisador XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        
        // 3. Extrair os dados das tags XML
        const latNode = xmlDoc.getElementsByTagName("latitude")[0];
        const lngNode = xmlDoc.getElementsByTagName("longitude")[0];
        const nomeNode = xmlDoc.getElementsByTagName("nome")[0];
        const raioNode = xmlDoc.getElementsByTagName("raio")[0];

        // 4. Verificar se as tags essenciais (lat/lng) existem
        if (!latNode || !lngNode) {
            throw new Error('XML recebido, mas sem tags <latitude> ou <longitude>.');
        }

        // 5. Retornar os dados reais da API
        console.log("Sucesso! Dados reais da API GIST carregados.");
        return {
            latitude: latNode.textContent,
            longitude: lngNode.textContent,
            nome: nomeNode ? nomeNode.textContent : `Posto ${numero}`,
            raio: raioNode ? parseFloat(raioNode.textContent) : 0
        };

    } catch (e) {
        // O bloco catch será executado se a API estiver offline OU
        // (MAIS PROVÁVEL) A REQUISIÇÃO FOR BLOQUEADA POR CORS!
        
        console.warn(`----------------------------------------------------------------`);
        console.warn(`ERRO AO ACESSAR API GIST: ${e.message}`);
        console.warn(`CAUSA PROVÁVEL: Bloqueio de CORS. O navegador impediu a chamada.`);
        console.warn(`SOLUÇÃO (TESTE): Ative uma extensão (ex: 'Allow CORS') no seu navegador.`);
        console.warn(`Usando dados de SIMULAÇÃO (Placeholder) para exibir no mapa.`);
        console.warn(`----------------------------------------------------------------`);

        // Retorna dados de simulação com nome claro
        return {
            latitude: PLACEHOLDER_LAT + (numero % 10) * 0.001, // Varia um pouco
            longitude: PLACEHOLDER_LNG + (numero % 10) * 0.001,
            nome: `POSTO SIMULADO ${numero} (FALHA DE API/CORS)`,
            raio: 150
        };
    }
}
// ****** FIM DA CORREÇÃO ******


/**
 * Desenha o marcador e os 3 raios (API, Entrada, Saída) para GIST ou Validador.
 */
function desenharRaio(lat, lng, nome, raioApi, raioEntrada, raioSaida, type) {
    
    // Remove apenas o marcador do mesmo tipo
    if (type === 'gist') {
        layerGroup.eachLayer(layer => {
            if (layer.options && layer.options.type === 'gist') layerGroup.removeLayer(layer);
        });
    } else if (type === 'validador') {
        layerGroup.eachLayer(layer => {
            if (layer.options && layer.options.type === 'validor') layerGroup.removeLayer(layer);
        });
    }
    
    const info = {
        name: nome,
        raioApi: raioApi,
        raioEntrada: raioEntrada,
        raioSaida: raioSaida
    };

    // 2. Cria o Marcador 
    const isValidador = (type === 'validador');
    const color = isValidador ? 'green' : 'blue';
    const iconUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="${color}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

    const customIcon = L.icon({
        iconUrl: iconUrl,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24]
    });

    const marker = L.marker([lat, lng], { icon: customIcon, type: type })
        .bindPopup(`<strong>${nome}</strong><br>Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`)
        .addTo(layerGroup);

    // 3. Raio da API (Azul) - SOMENTE para GIST e se raio > 0
    if (type === 'gist' && raioApi > 0) {
        L.circle([lat, lng], {
            color: 'blue', fillColor: '#3f83f8', fillOpacity: 0.3, radius: raioApi, weight: 2, dashArray: '5, 5', type: type
        }).addTo(layerGroup).bindPopup(`Raio API: ${raioApi}m`);
    }

    // 4. Raio de Entrada (Vermelho)
    L.circle([lat, lng], {
        color: 'red', fillColor: '#f87171', fillOpacity: 0.25, radius: raioEntrada, weight: 2, type: type
    }).addTo(layerGroup).bindPopup(`Raio Entrada: ${raioEntrada}m`);

    // 5. Raio de Saída (Amarelo)
    L.circle([lat, lng], {
        color: 'orange', fillColor: '#facc15', fillOpacity: 0.2, radius: raioSaida, weight: 2, type: type
    }).addTo(layerGroup).bindPopup(`Raio Saída: ${raioSaida}m`);

    // 6. Ajusta a visualização e atualiza o painel de informações
    map.setView([lat, lng], 16);
    updateInfoPanel(info);
}

/**
 * Atualiza o painel de informações na lateral
 */
function updateInfoPanel(info) {
    document.getElementById('nomePosto').textContent = info.name;
    document.getElementById('raioPosto').textContent =
        `API: ${info.raioApi}m | Entrada: ${info.raioEntrada}m | Saída: ${info.raioSaida}m`;
}

// --- FUNÇÕES DE INTERAÇÃO (Botões) ---

// 1. Busca GIST pelo Posto
document.getElementById('btnBuscarPosto').addEventListener('click', async () => {
    const numero = document.getElementById('postoInput').value.trim();
    const raioEntrada = parseInt(document.getElementById('raioEntrada').value) || 100;
    const raioSaida = parseInt(document.getElementById('raioSaida').value) || 200;

    if (!numero) return alert('Digite um número de posto para buscar no GIST.');

    try {
        // Chama a função fetchPosto (agora corrigida)
        const data = await fetchPosto(parseInt(numero));

        const lat = parseFloat(data.latitude);
        const lng = parseFloat(data.longitude);
        const nome = data.nome || `Posto ${numero}`;
        const raioApi = data.raio || 0;

        if (isNaN(lat) || isNaN(lng)) {
            return alert('Coordenadas inválidas recebidas.');
        }

        desenharRaio(lat, lng, nome, raioApi, raioEntrada, raioSaida, 'gist');

    } catch (err) {
        console.error("Erro no processamento do Posto:", err);
        alert('Erro ao buscar posto. Verifique o console para detalhes.');
    }
});

// 2. Usa Lat/Lng para Validadores
document.getElementById('btnUsarLatLng').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('latInput').value);
    const lng = parseFloat(document.getElementById('lngInput').value);
    const raioEntrada = parseInt(document.getElementById('raioEntrada').value) || 100;
    const raioSaida = parseInt(document.getElementById('raioSaida').value) || 200;

    if (isNaN(lat) || isNaN(lng)) {
        return alert('Informe latitude e longitude válidas para Validadores.');
    }

    desenharRaio(lat, lng, "Validadores (Manual)", 0, raioEntrada, raioSaida, 'validador');
});

// --- FUNÇÕES DA SONDA (Mouse Move & Fixação) ---

// 3. Inicializa o Marcador da Sonda
function initializeSondaMarker() {
    const customIcon = L.divIcon({
        className: 'sonda-marker-container',
        html: '<span class="sonda-marker"></span>',
        iconSize: [15, 15],
        iconAnchor: [7.5, 7.5]
    });

    sondaMarker = L.marker([0, 0], { icon: customIcon }).addTo(map);
    sondaMarker.setOpacity(0); // Esconde a sonda até ser ativada
}

// 4. Manipulador de Movimento do Mouse
function handleMouseMove(e) {
    if (!isSondaActive) return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    sondaMarker.setLatLng([lat, lng]).setOpacity(1);
    document.getElementById('sondaLat').textContent = lat.toFixed(6);
    document.getElementById('sondaLng').textContent = lng.toFixed(6);
}

// 5. Alterna Ativação da Sonda
function toggleSonda() {
    isSondaActive = !isSondaActive;
    const button = document.getElementById('toggleSonda');

    if (isSondaActive) {
        button.textContent = 'Desativar Sonda';
        button.classList.add('btn-primary');
        button.classList.remove('btn-secondary');
        map.on('mousemove', handleMouseMove);
        if (!fixedSondaMarker) {
             sondaMarker.setOpacity(1); 
        } else {
             sondaMarker.setOpacity(0);
        }
        document.getElementById('sondaLat').textContent = 'Aguardando...';
        document.getElementById('sondaLng').textContent = 'Aguardando...';
    } else {
        button.textContent = 'Ativar Sonda';
        button.classList.add('btn-secondary');
        button.classList.remove('btn-primary');
        map.off('mousemove', handleMouseMove);
        sondaMarker.setOpacity(0);
        if (fixedSondaMarker) {
             const latlng = fixedSondaMarker.getLatLng();
             document.getElementById('sondaLat').textContent = latlng.lat.toFixed(6);
             document.getElementById('sondaLng').textContent = latlng.lng.toFixed(6);
        } else {
             document.getElementById('sondaLat').textContent = 'Desativada';
             document.getElementById('sondaLng').textContent = 'Desativada';
        }
    }
}
document.getElementById('toggleSonda').addEventListener('click', toggleSonda);

// 6. Fixa Sonda com Botão Direito (Contextmenu) e Desenha Raio
map.on('contextmenu', (e) => {
    L.DomEvent.preventDefault(e); 

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const raioSonda = parseInt(document.getElementById('raioSonda').value) || 50;

    if (fixedSondaMarker) map.removeLayer(fixedSondaMarker);
    if (fixedSondaCircle) map.removeLayer(fixedSondaCircle);
    
    sondaMarker.setOpacity(0); 
    
    const customIcon = L.divIcon({
        className: 'sonda-marker-container fixed-sonda',
        html: '<span class="sonda-marker" style="background-color: #8A2BE2; border-color: white;"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    fixedSondaMarker = L.marker([lat, lng], { 
        icon: customIcon, 
        title: 'Sonda Fixada'
    }).addTo(map)
      .bindPopup(`<strong>Sonda Fixada</strong><br>Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}<br>Raio: ${raioSonda}m`).openPopup();
      
    fixedSondaCircle = L.circle([lat, lng], {
        color: '#8A2BE2',
        fillColor: '#8A2BE2',
        fillOpacity: 0.15, 
        radius: raioSonda, 
        weight: 2,
        type: 'sonda'
    }).addTo(map).bindPopup(`Raio Sonda: ${raioSonda}m`);

    if (isSondaActive) {
        toggleSonda();
    } else {
        document.getElementById('sondaLat').textContent = lat.toFixed(6);
        document.getElementById('sondaLng').textContent = lng.toFixed(6);
    }
    
    map.setView([lat, lng], 16);
});

// --- Inicialização Geral ---
initializeSondaMarker();
