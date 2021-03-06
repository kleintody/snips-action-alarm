import { translation, Database } from '../utils'
import { Handler, logger, message, i18n, config } from 'snips-toolkit'
import { NluSlot, slotType } from 'hermes-javascript/types'
import commonHandler, { KnownSlots } from './common'
import { Alarm } from '../utils/alarm'
import { SLOT_CONFIDENCE_THRESHOLD } from '../constants'
import { getExactDate } from '../utils'
import handlers from './index'

export const setAlarmHandler: Handler = async function (msg, flow, database: Database, knownSlots: KnownSlots = { depth: 2 }) {
    logger.info('SetAlarm')

    if (knownSlots.depth === 0) {
        throw new Error('intentNotRecognized')
    }

    const {
        name,
        recurrence
    } = await commonHandler(msg, knownSlots)

    let date: Date | undefined

    if (!('date' in knownSlots)) {
        const dateSlot: NluSlot<slotType.instantTime | slotType.timeInterval> | null = message.getSlotsByName(msg, 'datetime', {
            onlyMostConfident: true,
            threshold: SLOT_CONFIDENCE_THRESHOLD
        })

        if (dateSlot) {
            if (dateSlot.value.kind === 'TimeInterval') {
                date = getExactDate({ date: dateSlot.value.from })
            } else if (dateSlot.value.kind === 'InstantTime') {
                date = getExactDate({ date: dateSlot.value.value, grain: dateSlot.value.kind })
            }
        }
    } else {
        date = knownSlots.date
    }

    if (!date) {
        flow.continue(`${ config.get().assistantPrefix }:ElicitAlarmTime`, (msg, flow) => {
            /*
            if (msg.intent.confidenceScore < INTENT_FILTER_PROBABILITY_THRESHOLD) {
                throw new Error('intentNotRecognized')
            }
            */

            const options: { name?: string, date?: Date, recurrence?: string } = {}
            if (name) options.name = name
            if (recurrence) options.recurrence = recurrence
            if (date) options.date = date

            return handlers.setAlarm(msg, flow, database, {
                ...options,
                depth: knownSlots.depth - 1
            })
        })

        return i18n.translate('setAlarm.ask.time')
    }

    logger.info('\tdate: ', date)

    const alarm: Alarm = database.add(
        date,
        recurrence,
        name
    )

    flow.end()
    return translation.setAlarmToSpeech(alarm)
}
