const generateBtn = document.querySelector("#generateBtn");
const statusMessage = document.querySelector("#statusMessage");
const firstPokemonResult = document.querySelector("#firstPokemonResult");
const secondPokemonResult = document.querySelector("#secondPokemonResult");
const fusionPrompt = document.querySelector("#fusionPrompt");
const generatedImage = document.querySelector("#generatedImage");
const fusionHistory = document.querySelector("#fusionHistory");

const HISTORY_KEY = "pokemon-fusion-history";
const POKEDEX_LIMIT_URL = "https://pokeapi.co/api/v2/pokemon-species?limit=0";
const POKEMON_API = "https://pokeapi.co/api/v2/pokemon/";

renderHistory(loadHistory());
generateBtn.addEventListener("click", handleGenerateFusion);

async function handleGenerateFusion() {
  try {
    setStatus("무작위 포켓몬을 불러오는 중입니다...");
    generateBtn.disabled = true;
    const maxId = await getPokemonCount();
    const [firstId, secondId] = getTwoRandomIds(maxId);
    const [firstPokemon, secondPokemon] = await Promise.all([
      getPokemonData(firstId),
      getPokemonData(secondId),
    ]);

    const prompt = createFusionPrompt(firstPokemon, secondPokemon);
    renderPokemon(firstPokemonResult, firstPokemon);
    renderPokemon(secondPokemonResult, secondPokemon);
    renderPrompt(prompt);
    setStatus("생성형 이미지를 만드는 중입니다...");

    const fusion = await createFusionImage({
      prompt,
      firstPokemon,
      secondPokemon,
    });

    renderGeneratedImage(fusion.image, firstPokemon, secondPokemon);
    saveHistory({
      createdAt: new Date().toISOString(),
      prompt,
      image: fusion.image,
      firstPokemon,
      secondPokemon,
    });
    renderHistory(loadHistory());
    setStatus("포켓몬 합성이 완료되었습니다.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "포켓몬 합성에 실패했습니다.");
    renderFailureImage();
  } finally {
    generateBtn.disabled = false;
  }
}

function getTwoRandomIds(maxId) {
  const firstId = getRandomInt(1, maxId);
  let secondId = getRandomInt(1, maxId);

  while (secondId === firstId) {
    secondId = getRandomInt(1, maxId);
  }

  return [firstId, secondId];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getPokemonCount() {
  const response = await axios.get(POKEDEX_LIMIT_URL);
  return response.data.count;
}

async function getPokemonData(id) {
  const response = await axios.get(`${POKEMON_API}${id}`);
  const data = response.data;
  const speciesResponse = await axios.get(data.species.url);
  const koNameEntry = speciesResponse.data.names.find(
    (item) => item.language.name === "ko",
  );

  return {
    id: data.id,
    name: data.name,
    koName: koNameEntry?.name ?? data.name,
    image:
      data.sprites.other?.["official-artwork"]?.front_default ??
      data.sprites.front_default,
    type: data.types.map((item) => item.type.name),
  };
}

function createFusionPrompt(firstPokemon, secondPokemon) {
  return [
    `Create a single fused Pokémon illustration.`,
    `Blend ${firstPokemon.koName} and ${secondPokemon.koName} into one creature.`,
    `Use the color palette and silhouette inspired by ${firstPokemon.koName}'s ${firstPokemon.type.join(", ")} type and ${secondPokemon.koName}'s ${secondPokemon.type.join(", ")} type.`,
    `Style: clean, vibrant, game-ready creature design, centered composition, transparent background.`,
  ].join(" ");
}

async function createFusionImage(payload) {
  const response = await fetch("/api/fuse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || error.error || "이미지 생성 실패");
  }

  return response.json();
}

function renderPokemon(target, pokemon) {
  target.innerHTML = `
    <div class="pokemon-card">
      <img src="${pokemon.image}" alt="${pokemon.koName}" />
      <div class="pokemon-meta">
        <h4>${pokemon.koName}</h4>
        <p>#${pokemon.id.toString().padStart(4, "0")}</p>
        <p>${pokemon.name}</p>
        <p>${pokemon.type.join(" / ")}</p>
      </div>
    </div>
  `;
}

function renderPrompt(prompt) {
  fusionPrompt.textContent = prompt;
}

function renderGeneratedImage(image, firstPokemon, secondPokemon) {
  generatedImage.classList.remove("empty");
  generatedImage.innerHTML = `
    <figure class="generated-figure">
      <img src="${image}" alt="${firstPokemon.koName} ${secondPokemon.koName} fusion" />
      <figcaption>
        <strong>${firstPokemon.koName} + ${secondPokemon.koName}</strong>
        <p>최근 생성된 합성 이미지</p>
      </figcaption>
    </figure>
  `;
}

function renderFailureImage() {
  generatedImage.classList.add("empty");
  generatedImage.textContent = "이미지 생성에 실패했습니다.";
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(entry) {
  const history = loadHistory();
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 6)));
}

function renderHistory(history) {
  if (!history.length) {
    fusionHistory.innerHTML = `<p class="history-empty">아직 생성 기록이 없습니다.</p>`;
    return;
  }

  fusionHistory.innerHTML = history
    .map(
      (item) => `
        <article class="history-item">
          <img src="${item.image}" alt="${item.firstPokemon.koName} ${item.secondPokemon.koName}" />
          <div>
            <strong>${item.firstPokemon.koName} + ${item.secondPokemon.koName}</strong>
            <p>${new Date(item.createdAt).toLocaleString("ko-KR")}</p>
          </div>
        </article>
      `,
    )
    .join("");
}
