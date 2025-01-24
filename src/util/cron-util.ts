import { CronJob } from 'cron';

export function scheduleCommand(cronExpr: string, command: () => void) {
	new CronJob(
		cronExpr, // cronTime
		command, // onTick
		null, // onComplete
		true, // start
		'Europe/Berlin', // timeZone
	);
}
