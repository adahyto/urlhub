import { todayInPoland } from '$lib/featured';
import { featuredCovers } from '$lib/server/covers';
import type { PageServerLoad } from './$types';

// The day decides which seasonal sets show; read on the server so the page and the browser agree on it
export const load: PageServerLoad = () => ({ today: todayInPoland(), covers: featuredCovers() });
