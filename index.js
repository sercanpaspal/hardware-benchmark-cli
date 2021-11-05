#!/usr/bin/env node

const fetch = require("node-fetch");
const chalk = require("chalk");
const cheerio = require("cheerio");
const inquirer = require("inquirer");

const log = (str) => console.log(`\n${str}`);

const errorLog = (message) => log(chalk.red(message));

const warnLog = (message) => log(chalk.yellow(message));

const catchError = (e) => errorLog(e.message);

const [, , ...args] = process.argv;

if (args.length === 0)
	return warnLog(`Empty search terms! Usage: "hwb search terms"`);

const query = args.join(" ").trim();

const get = (url) => fetch(url).then((res) => res.text());

const parseHardwareInfo = (hardwarePage) => {
	try {
		$ = cheerio.load(hardwarePage);

		const specifications = Array.from($(".desc-body p"), (el) => {
			const key = $(el).find("strong").text().trim();

			return {
				key,
				value: $(el).text().replace(key, "").trim(),
			};
		});

		return {
			name: $(".cpuname").text(),
			point: $(".right-desc > span").text(),
			specifications,
		};
	} catch (e) {
		throw new Error("Could not parse hardware info!");
	}
};

const getHardware = (hardwareUrl) =>
	get(hardwareUrl)
		.then((hardwarePage) => {
			const { name, point, specifications } = parseHardwareInfo(hardwarePage);

			log(`Full Name: ${chalk.bold(name)}`);
			log(`Benchmark: ${chalk.underline.bgGreenBright.black.bold(point)}`);

			log(
				specifications
					.map(
						({ key, value }) =>
							`${chalk.bold(key)}${chalk.black.bgYellowBright(value)}`
					)
					.join("\n")
			);
		})
		.catch(catchError);

const getResults = async (query) => {
	const searchPage = await get(
		`https://www.passmark.com/search/zoomsearch.php?zoom_sort=0&zoom_xml=0&zoom_per_page=100&zoom_and=1&zoom_cat%5B%5D=5&zoom_query=${query}`
	);

	const $ = cheerio.load(searchPage);

	const results = Array.from($(".result_title a"), (el) => ({
		name: $(el).text(),
		value: el.attribs.href,
	})).filter(({ value }) => /cpu\.php|gpu\.php/.test(value));

	if (results.length === 0) throw new Error("No results found!");

	return results.map(({ name, value }) => ({
		value,
		name: chalk.grey(/- (.*) -/g.exec(name)[1]),
	}));
};

log(`Searching for ${chalk.bgWhiteBright.italic.black.bold(query)}...`);

getResults(query)
	.then((results) => {
		if (results.length > 1) {
			inquirer
				.prompt([
					{
						type: "list",
						message: "Which one exacly?",
						name: "value",
						choices: results,
					},
				])
				.then((e) => getHardware(e.value))
				.catch(catchError);
		} else {
			getHardware(results[0].value);
		}
	})
	.catch(catchError);
