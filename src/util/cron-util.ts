import { CronJob } from 'cron';
import type { DateTime } from 'luxon';

export function scheduleCommand(cronExpr: string | Date | DateTime, command: () => void) {
	new CronJob(
		cronExpr, // cronTime
		command, // onTick
		null, // onComplete
		true, // start
		'Europe/Berlin', // timeZone
	);
}
