const log = document.getElementById('log');
const DEFAULT_PORT = 80;
const SERVER_ADDR = '192.168.10.195';
let socketStopped = false;
let socket;

let serverIPInput = document.getElementById('serverIPInput');
let gamemodeDiv = document.getElementById('gamemodeDiv');
let controlsDiv = document.getElementById('gameControlDiv');
let specControlsDiv = document.getElementById('specControlsDiv');
let clientsDiv = document.getElementById('clientsDiv');
let modeBtnDiv = document.getElementById('modeBtnDiv');

let gameMode = 'none';
let spectators = [];
let gameStarted = false;

let prevGameStatusStarted = false;

function changeGameMode(mode) {
    gameMode = mode;
    socket.send(JSON.stringify({ 'type' : 'gamemode', 'data' : { 'name' : mode } }));
}

function addLog(message) {
    log.innerText += `${message}\n`;
}

function startSocketClick() {
    socketStopped = false;
    emptyLog();
    startSocket();
}

function setZoom() {
    const zoom = document.getElementById('zoomRange').value;
    socket.send(JSON.stringify({ 'type' : 'specZoom', 'data' : { 'specZoom' : (3.0 + zoom * 1.0) } }));
}

function emptyLog() {
    log.innerText = '';
}

function startSocket() {
    serverIPInput.disabled = true;
    let address = "ws://" + (serverIPInput.value === "" ? `${SERVER_ADDR}:${DEFAULT_PORT}` : `${serverIPInput.value + (serverIPInput.value.indexOf(':') === -1 ? ':' + DEFAULT_PORT : '')}`);
    socket = new WebSocket(address);

    socket.onerror = (error) => {
        if(socketStopped)
            return;

        console.log(error);
        addLog('Une erreur est survenue. Tentative de reconnexion...');
        socket = null;
        setTimeout(startSocket, 1000);
    }

    socket.onopen = () => {
        addLog('Connecté à Among Us!');
        socketStopped = false;
        resetControls();
    }

    socket.onmessage = (message) => {
        // addLog("Serveur: " + message.data);

        const jsonMsg = JSON.parse(message.data);

        console.log(jsonMsg);

        switch(jsonMsg.type) {
            case 'playersList':
                addLog("Joueurs:\n" + jsonMsg.data.map(player => `\t- ${player.id} - ${player.name} (${player.color})`).join('\n'));
                break;

            case 'clientsList':
                addLog("Clients:\n" + jsonMsg.data.map(player => `\t- ${player.clientId} - ${player.name} (Complete: ${!player.isIncomplete})`).join('\n'));
                clientsDiv.innerHTML = '';

                jsonMsg.data.forEach(client => {
                    if(client.isIncomplete)
                        return;

                    clientsDiv.innerHTML += `<button id="btnClient_${client.clientId}" data-client-id="${client.clientId}" onclick="toggleSpec(this, ${client.clientId})" class="togglableBtn ${spectators.includes(client.clientId) ? "pressed" : ""}">${client.name}</button>\n`;
                });
                break;

            case 'info':
            case 'error':
                addLog(jsonMsg.data.message);
                break;

            case 'gameMode':
            case 'gamemode':
                gameMode = jsonMsg.data.name;
                addLog(`Mode de jeu: ${gameMode}`);
                modeBtnDiv.querySelectorAll('.togglableBtn').forEach(btn => {
                    btn.classList.toggle("pressed", btn.dataset.mode === gameMode);
                });
                break;

            case 'gameData':
                showGameData(jsonMsg.data);
                break;

            case 'gameStatus':
                updateGameStatus(jsonMsg.data);
                break;

            default:
                addLog(`Type de message inconnu: ${message.data}`);
                break;
        }
    }

    socket.onclose = () => {
        addLog("Connexion fermée.");
        resetControls();
        socket = null;
        serverIPInput.disabled = false;
    }
}

function showGameData(data) {
    addLog("Réception des données de jeu...")
    resetControls();

    switch(data.gameMode) {
        case 'cestsus':
            setupCestSusControls(data);
            break;

        case 'agentdouble':
            setupAgentDoubleControls(data);
            break;

        case 'avelechat':
            setupAveLeChatControls(data);
            break;

        case 'toituvistoitutcreves':
            setupToituvistoitutcrevesControls(data);
            break;
    }
}

function updateGameStatus(data) {
    addLog(`Statut de jeu:\n- Game Started: ${data.isStarted}\n- Meeting Started: ${data.isMeeting}\n- Spectators ids: ${data.spectators.map(s => `${s.clientId}`).join(', ')}`);

    showGamemodeControls(!data.isStarted);
    showGameControls(data.isStarted);
    showSpecControls(data.isStarted && !data.isMeeting);

    spectators = data.spectators.map(s => s.clientId.toString());
    document.querySelectorAll('#clientsDiv .togglableBtn').forEach(btn => {
        btn.classList.toggle("pressed", spectators.includes(btn.dataset.clientId.toString()))
    });
	
	if(prevGameStatusStarted) {
		if(!data.isStarted) {
			setGameEnded();
		}
		else if(data.isMeeting) {
			setMeetingStarted();
		}
		else if(!data.isMeeting) {
			setMeetingEnded();
		}
	}
	else {
		if(data.isStarted) {
			setGameStarted();
		}
	}
}

function setGameStarted() {
	prevGameStatusStarted = true;
	
	setTimeout(() =>  {
		addLog("[BUTTONS] Envoi des boutons de début de partie (Mute All)");
		fetch("http://192.168.10.250:8000/api/location/5/2/0/step?step=1", {
			method: "POST"
		});
		fetch("http://192.168.10.250:8000/api/location/5/2/0/press", {
			method: "POST"
		});
	}, 8000);
	
	setTimeout(() =>  {
		addLog("[ZOOM] Mise à jour du zoom des specs");
		setZoom();
	}, 12000);
}

function setGameEnded() {
	prevGameStatusStarted = false;
	addLog("[BUTTONS] Envoi des boutons de fin de partie (Demute all)");
	fetch("http://192.168.10.250:8000/api/location/5/2/0/step?step=2", {
		method: "POST"
	});
	fetch("http://192.168.10.250:8000/api/location/5/2/0/press", {
		method: "POST"
	});
}

function setMeetingStarted() {
	addLog("[BUTTONS] Envoi du bouton de meeting (Demute All)");
	setTimeout(() => {
		fetch("http://192.168.10.250:8000/api/location/5/2/0/press", {
			method: "POST"
		});
	}, 1000);
}

function setMeetingEnded() {
	addLog("[BUTTONS] Envoi du bouton de fin de meeting (Mute All)");
	fetch("http://192.168.10.250:8000/api/location/5/2/0/press", {
		method: "POST"
	});
	addLog("[ZOOM] Mise à jour du zoom des specs");
	setZoom();
}

function pressControlBtn() {
	
}

function showGamemodeControls(doShow) {
    doShow ? gamemodeDiv.style.display = 'block' : gamemodeDiv.style.display = 'none';
}

function showGameControls(doShow) {
    doShow ? controlsDiv.style.display = 'block' : controlsDiv.style.display = 'none';
}

function resetControls() {
    controlsDiv.innerHTML = "";
    //showGamemodeControls(false);
}

function showSpecControls(doShow) {
    doShow ? specControlsDiv.style.display = 'block' : specControlsDiv.style.display = 'none';
}

function toggleSpec(btn, clientId) {
    socket.send(JSON.stringify({ 'type' : 'setSpec', 'data' : { 'clientId' : clientId, 'action': !btn.classList.contains("pressed") ? 'add' : 'remove' } }));
    btn.classList.toggle("pressed");
}

function refreshClientsList() {
    socket.send(JSON.stringify({ 'type' : 'refreshClients' }));
}

function setupCestSusControls(data) {
    controlsDiv.innerHTML = "<h2>Révéler des couleurs de joueurs</h2>\n";

    data.players.forEach(player => {
        controlsDiv.innerHTML += `<button id="btn${player.id}" onclick="revealPlayer(this, ${player.id})" class="togglableBtn ${player.isRevealed ? "pressed" : ""}" ${player.isRevealed ? "disabled" : ""}>${player.name} (${player.colorName})</button>\n`;
    });
}

function revealPlayer(btn, playerId) {
    socket.send(JSON.stringify({ 'type' : 'revealPlayer', 'data' : { 'playerId' : playerId } }));
    btn.disabled = true;
}

function setupAgentDoubleControls(data) {
    controlsDiv.innerHTML = "<h2>Débloquer une compétence</h2>\n";
    controlsDiv.innerHTML += `<button id="btnUnlockPerk" onclick="unlockPerk()" class="togglableBtn" ${data.impostorPerks === 3 ? "disabled" : ""}>${data.impostorPerks === 3 ? "Compétences maximales" : "Débloquer compétence " + (data.impostorPerks + 1)}</button>\n`;

    controlsDiv.innerHTML += "<p>Prochaine compétence: " + getNextPerk(data.impostorPerks) + "</p>\n";

    if(data.isMeeting) return;

    controlsDiv.innerHTML += `<h2>Tuer un crewmate</h2>\n`;
    data.players.forEach(player => {
        controlsDiv.innerHTML += `<button id="btnKill${player.id}" onclick="kill(${player.id})" class="togglableBtn" ${player.isImpostor || player.isDead ? "disabled" : ""}>${player.name}</button>\n`;
    });

    setupSabotageControls(data.map);
}

function unlockPerk() {
    socket.send(JSON.stringify({ 'type' : 'unlockPerk' }));
}

function getNextPerk(perks) {
    switch (perks) {
        case 0:
            return "Possibilité de nettoyer les corps";
        case 1:
            return "Possibilité de traverser les murs";
        case 2:
            return "Possibilité d'augmenter sa vitesse";
        case 3:
        default:
            return "Aucune, toutes les compétences sont débloquées";
    }
}

function setupAveLeChatControls(data) {
    controlsDiv.innerHTML = "<h2>Choisir l'Élu</h2>\n";

    data.players.forEach(player => {
        controlsDiv.innerHTML += `<button id="btn${player.id}" onclick="setElu(this, ${player.id})" class="togglableBtn ${player.isElu && !player.isDead ? "pressed" : ""}" ${player.isDead || player.isImpostor ? "disabled" : ""}>${player.name}</button>\n`;
    });

    controlsDiv.innerHTML += "<h2>Finir une task</h2>\n";
    controlsDiv.innerHTML += `<button id="btnFinishTask" onclick="finishTask()" class="togglableBtn" ${data.isMeeting || data.tasksLeft === 0 ? "disabled" : ""}>Finir une task (${data.tasksLeft} restante${data.tasksLeft > 1 ? "s" : ""})</button>\n`;

    if(!data.isMeeting) return;

    controlsDiv.innerHTML += `<h2>Vote du chat</h2>\n`;
    data.players.forEach(player => {
        controlsDiv.innerHTML += `<button id="btnVote_${player.id}" onclick="vote(${player.id})" class="togglableBtn ${player.id === data.voted ? "pressed" : ""}" ${player.isDead || data.voted < 255 ? "disabled" : ""}>${player.name}</button>\n`;
    });

    controlsDiv.innerHTML += `<button id="btnVoteSkip" onclick="vote(253)" class="togglableBtn ${data.voted == 253 ? "pressed" : ""}">Skip</button>\n`;
    controlsDiv.innerHTML += `<button id="btnVoteNothing" onclick="vote(255)" class="togglableBtn ${data.voted == 255 ? "pressed" : ""}">Ne pas voter</button>\n`;
}

function setElu(btn, playerId) {
    socket.send(JSON.stringify({ 'type' : 'setElu', 'data' : { 'playerId' : playerId } }));
    btn.disabled = true;
}

function vote(playerId) {
    socket.send(JSON.stringify({ 'type' : 'voteDuChat', 'data' : { 'playerId' : playerId } }));
}

function finishTask() {
    socket.send(JSON.stringify({ 'type' : 'finishTask' }));
}

function setupToituvistoitutcrevesControls(data) {
    controlsDiv.innerHTML = "<h2>Corrompre un joueur</h2>\n";

    data.players.forEach(player => {
        controlsDiv.innerHTML += `<button id="btnCorrupt${player.id}" onclick="corrupt(${player.id})" class="togglableBtn ${player.isImpostor ? "pressed" : ""}"  ${player.isDead || player.isImpostor ? "disabled" : ""}>${player.name}</button>\n`;
    });

    if(data.isMeeting) return;

    controlsDiv.innerHTML += `<h2>Tuer un crewmate</h2>\n`;
    data.players.forEach(player => {
        controlsDiv.innerHTML += `<button id="btnKill${player.id}" onclick="kill(${player.id})" class="togglableBtn" ${player.isImpostor || player.isDead ? "disabled" : ""}>${player.name}</button>\n`;
    });

    setupSabotageControls(data.map);
}

function setupSabotageControls(map) {
    controlsDiv.innerHTML += `<h2>Déclencher un sabotage</h2>`;
    switch(map) {
        case 'skeld':
            controlsDiv.innerHTML += `<button onclick="sabotage('reactor')" class="togglableBtn">Réacteurs</button>\n`;
            controlsDiv.innerHTML += `<button onclick="sabotage('comms')" class="togglableBtn">Communication</button>\n`;
            controlsDiv.innerHTML += `<button onclick="sabotage('lights')" class="togglableBtn">Lumières</button>\n`;
            controlsDiv.innerHTML += `<button onclick="sabotage('oxygen')" class="togglableBtn">Oxygène</button>\n`;
            break;
        case 'mira':
            controlsDiv.innerHTML += `<button onclick="sabotage('reactor')" class="togglableBtn">Réacteurs</button>\n`;
            controlsDiv.innerHTML += `<button onclick="sabotage('comms')" class="togglableBtn">Communication</button>\n`;
            controlsDiv.innerHTML += `<button onclick="sabotage('lights')" class="togglableBtn">Lumières</button>\n`;
            controlsDiv.innerHTML += `<button onclick="sabotage('oxygen')" class="togglableBtn">Oxygène</button>\n`;
            break;
        case 'polus':
            controlsDiv.innerHTML += `<button onclick="sabotage('reactor')" class="togglableBtn">Réacteurs</button>\n`;
            controlsDiv.innerHTML += `<button onclick="sabotage('comms')" class="togglableBtn">Communication</button>\n`;
            controlsDiv.innerHTML += `<button onclick="sabotage('lights')" class="togglableBtn">Lumières</button>\n`;
            break;
        case 'airship':
            controlsDiv.innerHTML += `<button onclick="sabotage('reactor')" class="togglableBtn">Réacteurs</button>\n`;
            controlsDiv.innerHTML += `<button onclick="sabotage('comms')" class="togglableBtn">Communication</button>\n`;
            controlsDiv.innerHTML += `<button onclick="sabotage('lights')" class="togglableBtn">Lumières</button>\n`;
            break;
        case 'fungle':
            controlsDiv.innerHTML += `<button onclick="sabotage('reactor')" class="togglableBtn">Réacteurs</button>\n`;
            controlsDiv.innerHTML += `<button onclick="sabotage('comms')" class="togglableBtn">Communication</button>\n`;
            controlsDiv.innerHTML += `<button onclick="sabotage('mixup')" class="togglableBtn">Camouflage Champignon</button>\n`;
            break;
    }
}

function sabotage(type) {
    socket.send(JSON.stringify({ 'type' : 'chatSabotage', 'data' : { 'type' : type } }));
}

function kill(playerId) {
    socket.send(JSON.stringify({ 'type' : 'chatKill', 'data' : { 'playerId' : playerId } }));
}

function corrupt(playerId) {
    socket.send(JSON.stringify({ 'type' : 'corrupt', 'data' : { 'playerId' : playerId } }));
}

function stopSocket() {
    if(!socket) {
        return;
    }
    showGamemodeControls(false);
    showGameControls(false);
    showSpecControls(false);
    spectators = [];

    socket.close();
    socket = null;
    socketStopped = true;
}
