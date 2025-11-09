// Função para simular a chamada à API (se a API real falhar ou não estiver acessível)
async function fetchPosto(numero) {
    try {
        const resp = await fetch(`${API_URL}${numero}`);
        if (!resp.ok) throw new Error('API indisponível ou erro 404.');
        
        // 1. Obter a resposta como TEXTO (pois é XML)
        const xmlString = await resp.text();
        
        // 2. Iniciar o analisador XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        
        // 3. Extrair os dados das tags XML
        // (Assumindo que os nomes das tags são 'latitude', 'longitude', 'nome' e 'raio')
        const latNode = xmlDoc.getElementsByTagName("latitude")[0];
        const lngNode = xmlDoc.getElementsByTagName("longitude")[0];
        const nomeNode = xmlDoc.getElementsByTagName("nome")[0];
        const raioNode = xmlDoc.getElementsByTagName("raio")[0];

        // 4. Verificar se as tags essenciais (lat/lng) existem
        if (!latNode || !lngNode) {
            throw new Error('Formato XML inesperado ou tags <latitude>/<longitude> não encontradas.');
        }

        // 5. Retornar os dados no formato de objeto que o resto do script espera
        return {
            latitude: latNode.textContent,
            longitude: lngNode.textContent,
            nome: nomeNode ? nomeNode.textContent : `Posto ${numero}`,
            raio: raioNode ? parseFloat(raioNode.textContent) : 0
        };

    } catch (e) {
        // O bloco catch agora só será usado se a API estiver offline ou o XML for inválido
        console.warn(`Erro ao acessar ou processar API (${e.message}). Usando dados de simulação.`);
        // Dados simulados para garantir a funcionalidade
        return {
            latitude: PLACEHOLDER_LAT + (numero % 10) * 0.001, // Varia um pouco
            longitude: PLACEHOLDER_LNG + (numero % 10) * 0.001,
            nome: `Posto Simulador ${numero}`,
            raio: 150 // Raio API simulado
        };
    }
}
