const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.POSTGRES_CONNECTION_STRING,
});

async function getRandomFurryPost(tags, rating = null) {
    const wgh = +(!!rating) + (rating !== 'e');
    try {
        // If no tags are specified, return a random post with at least one tag
        if (tags.length === 0) {
            const query = {
                text: `
                    SELECT id, md5, tag_array, rating, file_ext, up_score - down_score AS score
                    FROM posts
                    TABLESAMPLE BERNOULLI (0.035)
                    ${rating ? 'WHERE rating = $1': ''}
                    LIMIT 1
                `,
                values: [],
            };
            if (rating)
                query.values.push(rating);

            const result = await pool.query(query);
            return result.rows[0];
        }

        const id = parseInt(tags[0], 10);
        if (tags.length === 1 && id && !isNaN(id)) {
            const query = {
                text: `
                    SELECT id, md5, tag_array, rating, file_ext, up_score - down_score AS score
                    FROM posts
                    WHERE id = $1
                `,
                values: [id],
            };
            const result = await pool.query(query);
            if (result.rowCount > 0)
                return result.rows[0];
        }

        // If tags are specified, return a random post that matches all positive tags and none of the negative tags
        const positiveTags = tags.filter(tag =>!tag.startsWith('-'));
        const negativeTags = tags.filter(tag => tag.startsWith('-')).map(tag => tag.substring(1));

	const query = {
	    text: `
		SELECT id, md5, tag_array, rating, file_ext, up_score - down_score AS score
		FROM posts
                ${((wgh + tags.length) <= 1) ? ('TABLESAMPLE BERNOULLI (0.05)') : (((wgh + tags.length) <= 3) ? 'TABLESAMPLE BERNOULLI (0.6)' : '')}
		WHERE 
		    (tag_array @> $1::text[]) AND 
		    (NOT tag_array && $2::text[])
		    ${rating ? `AND rating = $3` : ''}
                ${(wgh + tags.length) > 3 ? 'ORDER BY RANDOM()' : ''}
		LIMIT 1
	    `,
	    values: [positiveTags, negativeTags],
	};/**/
        if (rating)
            query.values.push(rating);

        const result = await pool.query(query);
        return result.rows[0];
    } catch (error) {
        console.error(`Error executing query: ${error.message}`);
        return null;
    }
}

function sanitizeTags(tags) {
    return tags.toLowerCase()
                .replace(/[^0-9a-z_(){}<>:;\/\\'\"\,\.\?\#\$\%\^\&\*\~\-\s]/g, ' ')
                .split(/\s+/)
                .filter(tag => tag.length);
}

module.exports = { getRandomFurryPost, sanitizeTags };
