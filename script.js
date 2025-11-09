// Configuração e Inicialização do Mapa
const map = L.map('map').setView([-3.7678, -38.5365], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
}).addTo(map);

// Variáveis de Estado Global
let isSondaActive = false;
let sondaMarker; // Marcador que segue o mouse

// Grupos de Camadas (FeatureGroups)
// Isso permite limpar GIST e Validadores separadamente
let postoLayerGroup = L.featureGroup().addTo(map);
let validadorLayerGroup = L.featureGroup().addTo(map);
let fixedSondaMarkers = L.featureGroup().addTo(map); // Grupo para marcadores fixos da sonda

// Inicialização do Marcador da Sonda (Invisível por padrão)
sondaMarker = L.marker([0, 0], { 
    opacity: 0, 
    interactive: false // Impede que o marcador flutuante capture cliques
}).addTo(map);

// Função para formatar coordenadas
function formatCoord(coord) {
    return coord.toFixed(6);
}

// 1. GIST - Busca por Posto
async function buscarPosto() {
    const numero = document.getElementById('postoInput').value.trim();
    if (!numero) {
        alert('Digite um número de posto');
        return;
    }

    let data;

    try {
        // Tenta buscar na API real
        const resp = await fetch(`http://gistapis.etufor.ce.gov.br:8081/api/postoControle/${numero}`);
        if (!resp.ok) {
            throw new Error(`Erro na API: Status ${resp.status}`);
        }
        data = await resp.json();
    } catch (err) {
        // Se a API falhar, usa dados simulados
        console.warn(`Falha ao acessar API GIST. Usando dados simulados para o posto ${numero}. Erro:`, err.message);
        data = simularDadosPosto(numero);
        
        if (!data) {
            // Se não houver simulação para o número, alerta o usuário
            return alert(`Posto ${numero} não encontrado na simulação. API real falhou.`);
        }
    }

    // Mapeamento dos campos
    const lat = parseFloat(data.latitude || data.Lat);
    const lng = parseFloat(data.longitude || data.Lng);
    const nome = data.nome || data.Nome || `Posto ${numero}`;
    const raioApi = parseInt(data.raio || data.Raio || 100); 

    if (isNaN(lat) || isNaN(lng) || !lat || !lng) {
        return alert('Coordenadas inválidas recebidas da API/Simulação.');
    }

    const raioEntrada = parseInt(document.getElementById('raioEntrada').value) || 100;
    const raioSaida = parseInt(document.getElementById('raioSaida').value) || 200;

    desenharRaio(lat, lng, nome, raioApi, raioEntrada, raioSaida, 'gist');
}

// Simulação de dados para teste (apenas para fallback)
function simularDadosPosto(numero) {
    const postos = {
        '1': { nome: 'Posto Simulado 1 (GIST)', latitude: -3.7650, longitude: -38.5350, raio: 100 },
        '2': { nome: 'Posto Simulado 2 (GIST)', latitude: -3.7500, longitude: -38.5200, raio: 80 },
        '3': { nome: 'Posto Simulado 3 (GIST)', latitude: -3.7780, longitude: -38.5450, raio: 120 }
    };
    return postos[numero.toString()];
}

// 2. Validadores - Coordenada Manual
function usarLatLng() {
    const lat = parseFloat(document.getElementById('latInput').value);
    const lng = parseFloat(document.getElementById('lngInput').value);

    if (isNaN(lat) || isNaN(lng)) {
        return alert('Informe latitude e longitude válidas');
    }

    // Pega os raios da seção GIST (conforme o layout original)
    const raioEntrada = parseInt(document.getElementById('raioEntrada').value) || 100;
    const raioSaida = parseInt(document.getElementById('raioSaida').value) || 200;

    desenharRaio(lat, lng, "Coordenada Manual (Validadores)", 0, raioEntrada, raioSaida, 'validador');
}

// Função principal de desenho de raios (GIST e Validadores)
function desenharRaio(lat, lng, nome, raioApi, raioEntrada, raioSaida, tipo) {
    // Seleciona o grupo de camadas correto
    let currentLayerGroup = (tipo === 'gist') ? postoLayerGroup : validadorLayerGroup;

    // Limpa APENAS as camadas anteriores deste tipo
    // Isso permite que GIST e Validadores coexistam
    currentLayerGroup.clearLayers();

    // Marcador
    const marker = L.marker([lat, lng]).bindPopup(`${nome}`).addTo(currentLayerGroup);

    // Raio da API (Azul) - Apenas para GIST
    if (tipo === 'gist' && raioApi > 0) {
        L.circle([lat, lng], {
            color: 'blue', fillColor: '#3f83f8', fillOpacity: 0.3, radius: raioApi, weight: 1
        }).addTo(currentLayerGroup);
    }

    // Raio de Entrada (Vermelho)
    L.circle([lat, lng], {
        color: 'red', fillColor: '#f87171', fillOpacity: 0.3, radius: raioEntrada, weight: 1
    }).addTo(currentLayerGroup);

    // Raio de Saída (Amarelo)
    L.circle([lat, lng], {
        color: 'orange', fillColor: '#facc15', fillOpacity: 0.3, radius: raioSaida, weight: 1
    }).addTo(currentLayerGroup);

    map.setView([lat, lng], 16);

    // Atualiza o painel de informações
    document.getElementById('nomePosto').textContent = nome;
    document.getElementById('raioPosto').textContent =
        `API: ${raioApi} m | Entrada: ${raioEntrada} m | Saída: ${raioSaida} m`;
}

// --- 3. Lógica da Sonda (Controle por Mouse) ---

// Evento de Movimento do Mouse
map.on('mousemove', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    // Atualiza as coordenadas no painel SEMPRE
    document.getElementById('sondaLat').textContent = formatCoord(lat);
    document.getElementById('sondaLng').textContent = formatCoord(lng);
    
    // Move o marcador da sonda flutuante SE estiver ativo
    if (isSondaActive) {
        sondaMarker.setLatLng([lat, lng]);
    }
});

// Alterna o estado da Sonda (Ativar/Desativar)
function toggleSonda() {
    isSondaActive = !isSondaActive;
    const button = document.getElementById('toggleSonda');
    
    if (isSondaActive) {
        button.textContent = 'Desativar Sonda';
        button.classList.add('active');
        sondaMarker.setOpacity(1); // Torna o marcador flutuante visível
        map.getContainer().style.cursor = 'crosshair';
    } else {
        button.textContent = 'Ativar Sonda';
        button.classList.remove('active');
        sondaMarker.setOpacity(0); // Torna o marcador flutuante invisível
        map.getContainer().style.cursor = '';
    }
}

// Fixa o Marcador da Sonda com Botão Direito (Contextmenu)
map.on('contextmenu', function(e) {
    // Previne o menu de contexto padrão do navegador
    e.originalEvent.preventDefault();

    // Pega as coordenadas e o raio
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const raioSonda = parseInt(document.getElementById('raioSondaInput').value) || 150;
    
    // Cria um ícone de "pino" (emoji)
    const fixedIcon = L.divIcon({
        className: 'sonda-fixed-icon',
        html: '📍',
        iconSize: [24, 24],
        iconAnchor: [12, 24] // Ponta do pino
    });

    // Fixa um novo marcador
    const fixedMarker = L.marker([lat, lng], {
        icon: fixedIcon
    }).bindPopup(`Sonda Fixa: ${formatCoord(lat)}, ${formatCoord(lng)} | Raio: ${raioSonda}m`);
    
    // Desenha o Raio da Sonda (Roxo)
    const sondaCircle = L.circle([lat, lng], {
        color: '#a855f7', 
        fillColor: '#a855f7', 
        fillOpacity: 0.2, 
        radius: raioSonda, 
        weight: 2
    });

    // Adiciona marcador e círculo ao grupo de fixos
    fixedSondaMarkers.addLayer(fixedMarker);
    fixedSondaMarkers.addLayer(sondaCircle);

    // Opcional: Desativa a Sonda em movimento após fixar
    if (isSondaActive) {
        toggleSonda();
    }
});

// Evento de "Enter" no campo posto
document.getElementById('postoInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        buscarPosto();
    }
});
