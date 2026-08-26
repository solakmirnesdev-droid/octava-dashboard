<script setup>
import { ref, computed, onMounted } from 'vue';
import client from '../api/client';
import { useToasts } from '../composables/useToasts';
import IconAdd from '~icons/material-symbols/add-circle-outline-rounded';
import IconUpload from '~icons/material-symbols/upload-rounded';
import IconDelete from '~icons/material-symbols/delete-outline-rounded';
import IconPerson from '~icons/material-symbols/person-outline-rounded';

/**
 * Artists, and everything that hangs off one.
 *
 * Until now they only came into existence as a side effect of adding a song,
 * so nobody could give one a portrait, a country or a genre. This is the first
 * place they can be created on purpose.
 */
const toasts = useToasts();

const MAX_BYTES = 10 * 1024;

/** Countries the catalogue actually covers, plus the ones it borders. */
const COUNTRIES = [
  { code: 'BA', name: 'Bosna i Hercegovina' },
  { code: 'HR', name: 'Hrvatska' },
  { code: 'RS', name: 'Srbija' },
  { code: 'ME', name: 'Crna Gora' },
  { code: 'MK', name: 'Sjeverna Makedonija' },
  { code: 'SI', name: 'Slovenija' },
  { code: 'XK', name: 'Kosovo' },
  { code: 'YU', name: 'Jugoslavija (istorijski)' },
  { code: 'AT', name: 'Austrija' },
  { code: 'DE', name: 'Njemačka' },
  { code: 'BG', name: 'Bugarska' },
  { code: 'AL', name: 'Albanija' }
];

/** The flag is derived, never stored — one country has exactly one. */
const flagOf = (code) => (code && /^[A-Z]{2}$/.test(code)
  ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
  : '');

const artists = ref([]);
const genres = ref([]);
const loading = ref(true);
const filter = ref('');
const saving = ref(false);

/** null = closed, {} = creating, {…} = editing. */
const editing = ref(null);
const form = ref({ name: '', country: '', bio: '', genres: [] });
const fileInput = ref(null);
/** Bumped after an upload so the browser refetches instead of using its cache. */
const imageVersion = ref(Date.now());

const apiBase = import.meta.env.VITE_API_URL || '/api';

const visible = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return artists.value;
  return artists.value.filter((a) => a.name.toLowerCase().includes(q));
});

async function load() {
  loading.value = true;
  try {
    const [{ data: a }, { data: g }] = await Promise.all([
      client.get('/artists', { params: { limit: 100 } }),
      client.get('/genres')
    ]);
    artists.value = a.artists || [];
    genres.value = g.genres || [];
  } catch {
    toasts.error('Učitavanje nije uspjelo.');
  } finally {
    loading.value = false;
  }
}

function startCreate() {
  editing.value = {};
  form.value = { name: '', country: '', bio: '', genres: [] };
}

function startEdit(a) {
  editing.value = a;
  form.value = {
    name: a.name,
    country: a.country || '',
    bio: a.bio || '',
    genres: (a.genres || []).map((g) => g.slug || g)
  };
}

async function save() {
  if (!form.value.name.trim()) { toasts.error('Ime je obavezno.'); return; }
  saving.value = true;
  try {
    const body = {
      name: form.value.name.trim(),
      country: form.value.country || null,
      bio: form.value.bio,
      genres: form.value.genres
    };
    const { data } = editing.value?._id
      ? await client.put(`/artists/${editing.value._id}`, body)
      : await client.post('/artists', body);

    toasts.success(editing.value?._id ? 'Izmjene sačuvane.' : `Dodan: ${data.artist.name}`);
    editing.value = data.artist;
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Spašavanje nije uspjelo.');
  } finally {
    saving.value = false;
  }
}

async function removeArtist(a) {
  if (!confirm(`Obrisati izvođača „${a.name}"?`)) return;
  try {
    await client.delete(`/artists/${a._id}`);
    toasts.success('Obrisan.');
    if (editing.value?._id === a._id) editing.value = null;
    await load();
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Brisanje nije uspjelo.');
  }
}

/**
 * Checked here as well as on the server.
 *
 * The server is what actually enforces this; doing it in the browser too means
 * somebody who picked a 3 MB photo learns immediately instead of after the
 * upload finishes.
 */
async function pickImage(event) {
  const file = event.target.files?.[0];
  if (!file || !editing.value?._id) return;

  if (file.size > MAX_BYTES) {
    toasts.error(`Slika je ${(file.size / 1024).toFixed(1)} KB; najviše je 10 KB.`);
    event.target.value = '';
    return;
  }

  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (from, to) => String.fromCharCode(...head.slice(from, to));
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 12) !== 'WEBP') {
    toasts.error('Slika mora biti u WebP formatu.');
    event.target.value = '';
    return;
  }

  try {
    await client.post(`/artists/${editing.value._id}/image`, file, {
      headers: { 'Content-Type': 'image/webp' }
    });
    toasts.success('Slika postavljena.');
    imageVersion.value = Date.now();
    await load();
    editing.value = artists.value.find((a) => a._id === editing.value._id) || editing.value;
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Slanje nije uspjelo.');
  } finally {
    event.target.value = '';
  }
}

async function removeImage() {
  if (!editing.value?._id) return;
  try {
    await client.delete(`/artists/${editing.value._id}/image`);
    toasts.success('Slika uklonjena.');
    imageVersion.value = Date.now();
    await load();
    editing.value = artists.value.find((a) => a._id === editing.value._id) || editing.value;
  } catch (err) {
    toasts.error(err.response?.data?.message || 'Uklanjanje nije uspjelo.');
  }
}

const imageUrl = (a) => `${apiBase}/artists/${a._id}/image?v=${imageVersion.value}`;

onMounted(load);
</script>

<template>
  <section>
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold tracking-tight">Izvođači</h1>
      <span class="text-sm text-black/45">{{ artists.length }}</span>

      <input
        v-model="filter" placeholder="Filtriraj po imenu"
        class="ml-auto w-56 rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-accent"
      >
      <button
        class="rounded bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent"
        @click="startCreate"
      >
        <span class="flex items-center gap-1.5"><IconAdd /> Novi izvođač</span>
      </button>
    </div>

    <!-- The editor sits above the list rather than in a dialog: uploading a
         picture and checking it against the others is one task, not two. -->
    <div v-if="editing" class="mb-6 rounded border border-accent/30 bg-accent/[0.03] px-4 py-4">
      <h2 class="mb-3 text-sm font-medium">
        {{ editing._id ? `Uređivanje: ${editing.name}` : 'Novi izvođač' }}
      </h2>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label class="block">
          <span class="text-sm font-medium">Ime</span>
          <input
            v-model="form.name"
            class="mt-1 w-full rounded border border-black/15 px-3 py-2 outline-none focus:border-accent"
          >
        </label>

        <label class="block">
          <span class="text-sm font-medium">Zemlja</span>
          <select
            v-model="form.country"
            class="mt-1 w-full rounded border border-black/15 px-3 py-2 outline-none focus:border-accent"
          >
            <option value="">— bez zemlje —</option>
            <option v-for="c in COUNTRIES" :key="c.code" :value="c.code">
              {{ flagOf(c.code) }} {{ c.name }}
            </option>
          </select>
        </label>

        <div class="lg:col-span-2">
          <span class="text-sm font-medium">Rubrike</span>
          <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <label v-for="g in genres" :key="g.slug" class="flex items-center gap-1.5 text-sm">
              <input v-model="form.genres" type="checkbox" :value="g.slug" class="accent-accent">
              {{ g.name }}
            </label>
          </div>
        </div>
      </div>

      <label class="mt-4 block">
        <span class="text-sm font-medium">Biografija</span>
        <textarea
          v-model="form.bio" rows="3" maxlength="2000"
          class="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      <!-- Only after saving: the picture is posted to an id that does not exist
           until the artist does. -->
      <div v-if="editing._id" class="mt-4 flex flex-wrap items-center gap-4">
        <img
          v-if="editing.hasImage" :src="imageUrl(editing)" alt=""
          class="size-16 rounded object-cover ring-1 ring-black/10"
        >
        <div v-else class="flex size-16 items-center justify-center rounded bg-black/5 text-black/25">
          <IconPerson class="text-2xl" />
        </div>

        <div>
          <input ref="fileInput" type="file" accept="image/webp" class="hidden" @change="pickImage">
          <div class="flex gap-2">
            <button
              class="rounded border border-black/15 px-3 py-1.5 text-sm hover:border-accent"
              @click="fileInput.click()"
            ><span class="flex items-center gap-1.5"><IconUpload /> Postavi sliku</span></button>
            <button
              v-if="editing.hasImage"
              class="rounded border border-black/15 px-3 py-1.5 text-sm hover:border-rose-400 hover:text-rose-700"
              @click="removeImage"
            ><span class="flex items-center gap-1.5"><IconDelete /> Ukloni</span></button>
          </div>
          <p class="mt-1 text-xs text-black/45">WebP, najviše 10 KB.</p>
        </div>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <button class="rounded px-4 py-2 text-sm text-black/60 hover:text-accent" @click="editing = null">
          Zatvori
        </button>
        <button
          class="rounded bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-accent disabled:opacity-50"
          :disabled="saving" @click="save"
        >{{ saving ? 'Spašavanje…' : 'Sačuvaj' }}</button>
      </div>
    </div>

    <p v-if="loading" class="text-sm text-black/45">Učitavanje…</p>

    <ul v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="a in visible" :key="a._id"
        class="flex items-center gap-3 rounded border border-black/10 bg-white px-3 py-2"
      >
        <img
          v-if="a.hasImage" :src="imageUrl(a)" alt=""
          class="size-10 shrink-0 rounded object-cover ring-1 ring-black/10"
        >
        <div v-else class="flex size-10 shrink-0 items-center justify-center rounded bg-black/5 text-black/25">
          <IconPerson />
        </div>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">
            <span v-if="a.flag" class="mr-1">{{ a.flag }}</span>{{ a.name }}
          </p>
          <p class="text-xs text-black/45">{{ a.songCount }} pjesama</p>
        </div>

        <button class="text-xs text-black/45 hover:text-accent" @click="startEdit(a)">Uredi</button>
        <button
          class="text-xs text-black/35 hover:text-rose-700"
          :title="a.songCount ? 'Ima pjesama — prvo ih prebaci' : 'Obriši'"
          @click="removeArtist(a)"
        >Obriši</button>
      </li>
    </ul>
  </section>
</template>
