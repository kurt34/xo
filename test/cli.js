import fs from 'fs';
import path from 'path';
import test from 'ava';
import execa from 'execa';
import slash from 'slash';
import tempWrite from 'temp-write';

process.chdir(__dirname);

const cli = (...args) => {
	const cliPath = path.join(__dirname, '../cli.js');
	return execa(...[cliPath, ...args]);
};

test('fix option', async t => {
	const filepath = await tempWrite('console.log()\n', 'x.js');
	await cli(['--no-local', '--fix', filepath]);
	t.is(fs.readFileSync(filepath, 'utf8').trim(), 'console.log();');
});

test('fix option with stdin', async t => {
	const {stdout} = await cli(['--no-local', '--fix', '--stdin'], {
		input: 'console.log()\n'
	});
	t.is(stdout.trim(), 'console.log();');
});

test('stdin-filename option with stdin', async t => {
	const {stdout} = await cli(['--no-local', '--stdin', '--stdin-filename=unicorn-file'], {
		input: 'console.log()\n',
		reject: false
	});
	t.regex(stdout, /unicorn-file:/);
});

test('reporter option', async t => {
	const filepath = await tempWrite('console.log()\n', 'x.js');

	try {
		await cli(['--no-local', '--reporter=compact', filepath]);
	} catch (err) {
		t.true(err.stdout.indexOf('Error - ') !== -1);
	}
});

test('overrides fixture', async t => {
	const cwd = path.join(__dirname, 'fixtures/overrides');
	await t.notThrows(cli(['--no-local'], {cwd}));
});

// https://github.com/sindresorhus/xo/issues/65
test.failing('ignores fixture', async t => {
	const cwd = path.join(__dirname, 'fixtures/ignores');
	await t.throws(cli(['--no-local'], {cwd}));
});

test('ignore files in .gitignore', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	const err = await t.throws(cli(['--no-local', '--reporter=json'], {cwd}));
	const reports = JSON.parse(err.stdout);
	const files = reports
		.map(report => path.relative(cwd, report.filePath))
		.map(slash);
	t.deepEqual(files, ['index.js', 'test/bar.js']);
});

test('ignore explicit files when in .gitgnore', async t => {
	const cwd = path.join(__dirname, 'fixtures/gitignore');
	await t.notThrows(cli(['test/foo.js', '--no-local', '--reporter=json'], {cwd}));
});

test('negative gitignores', async t => {
	const cwd = path.join(__dirname, 'fixtures/negative-gitignore');
	const err = await t.throws(cli(['--no-local', '--reporter=json'], {cwd}));
	const reports = JSON.parse(err.stdout);
	const files = reports.map(report => path.relative(cwd, report.filePath));
	t.deepEqual(files, ['foo.js']);
});

test('supports being extended with a shareable config', async t => {
	const cwd = path.join(__dirname, 'fixtures/project');
	await t.notThrows(cli(['--no-local'], {cwd}));
});

test('quiet option', async t => {
	const filepath = await tempWrite('// TODO: quiet\nconsole.log()\n', 'x.js');
	const err = await t.throws(cli(['--no-local', '--quiet', '--reporter=json', filepath]));
	const [report] = JSON.parse(err.stdout);
	t.is(report.warningCount, 0);
});
