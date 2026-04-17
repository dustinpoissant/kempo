import getMenuBySlug from '../../../../../server/utils/menus/fns/getMenuBySlug.js';

export default async (request, response) => {
	const slug = request.query.slug;

	if(!slug){
		return response.status(400).json({ error: 'Slug query parameter is required' });
	}

	const [error, result] = await getMenuBySlug(slug);

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
