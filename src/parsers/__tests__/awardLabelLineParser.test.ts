import { describe, it, expect } from 'vitest';
import { parseLabelLines } from '../awardLabelLineParser';

describe('parseLabelLines', () => {
  it('parses a standard 1st place label with an over-a-minute time', () => {
    const label = parseLabelLines([
      '1st Place Time: 1:02.34',
      '#1 Boys 12&U 100m IM',
      'Skywalker, Luke (12)',
      'Jedi Swim Academy – Jun 8, 2025',
      'Coruscant Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.place).toBe(1);
    expect(label!.placeOrdinal).toBe('1st');
    expect(label!.finishTime).toBe('1:02.34');
    expect(label!.eventNumber).toBe('1');
    expect(label!.eventDescription).toBe('Boys 12&U 100m IM');
    expect(label!.lastName).toBe('Skywalker');
    expect(label!.firstName).toBe('Luke');
    expect(label!.age).toBe(12);
    expect(label!.team).toBe('Jedi Swim Academy');
    expect(label!.date).toBe('Jun 8, 2025');
    expect(label!.meetName).toBe('Coruscant Cup 2025');
  });

  it('parses a sub-minute finish time', () => {
    const label = parseLabelLines([
      '2nd Place Time: 28.14',
      '#7B Boys 7-8 25m Free',
      'Solo, Han (8)',
      'Jedi Swim Academy – Jun 8, 2025',
      'Coruscant Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.finishTime).toBe('28.14');
  });

  it('converts place ordinals to numbers correctly', () => {
    const first  = parseLabelLines(['1st Place Time: 30.00', '#1 Event', 'A, B (10)', 'Team – Jun 1, 2025', 'Meet']);
    const second = parseLabelLines(['2nd Place Time: 30.00', '#1 Event', 'A, B (10)', 'Team – Jun 1, 2025', 'Meet']);
    const third  = parseLabelLines(['3rd Place Time: 30.00', '#1 Event', 'A, B (10)', 'Team – Jun 1, 2025', 'Meet']);
    expect(first!.place).toBe(1);
    expect(second!.place).toBe(2);
    expect(third!.place).toBe(3);
  });

  it('parses an event number with a letter suffix', () => {
    const label = parseLabelLines([
      '1st Place Time: 25.31',
      '#7B Boys 7-8 25m Free',
      'Solo, Han (8)',
      'Jedi Swim Academy – Jun 8, 2025',
      'Coruscant Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.eventNumber).toBe('7B');
    expect(label!.eventDescription).toBe('Boys 7-8 25m Free');
  });

  it('parses a hyphenated last name', () => {
    const label = parseLabelLines([
      '1st Place Time: 1:42.06',
      '#3 Boys 13-14 100m IM',
      'Fett-Wren, Paz (13)',
      'Jedi Swim Academy – Jun 8, 2025',
      'Coruscant Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.lastName).toBe('Fett-Wren');
    expect(label!.firstName).toBe('Paz');
  });

  it('parses a doubly-hyphenated last name', () => {
    const label = parseLabelLines([
      '1st Place Time: 1:18.62',
      '#6 Women 15-18 100m IM',
      'Kryze-Wren-Djarin, Bo (16)',
      'Jedi Swim Academy – Jun 8, 2025',
      'Coruscant Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.lastName).toBe('Kryze-Wren-Djarin');
    expect(label!.firstName).toBe('Bo');
  });

  it('parses a multi-word first name', () => {
    const label = parseLabelLines([
      '1st Place Time: 36.52',
      '#18B Girls 7-8 25m Back',
      'Wan Kenobi, Obi Dee (7)',
      'Jedi Swim Academy – Jun 8, 2025',
      'Coruscant Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.lastName).toBe('Wan Kenobi');
    expect(label!.firstName).toBe('Obi Dee');
  });

  it('parses a relay team designator in team name', () => {
    const label = parseLabelLines([
      '1st Place Time: 1:55.00',
      '#12 Mixed 11-12 100m Medley Relay',
      'JDA, A (12)',
      'Jedi A – Jun 8, 2025',
      'Coruscant Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.team).toBe('Jedi A');
  });

  it('returns null when fewer than 5 lines are provided', () => {
    expect(parseLabelLines([
      '1st Place Time: 1:02.34',
      '#1 Boys 12&U 100m IM',
    ])).toBeNull();
  });

  it('returns null when any line is empty', () => {
    expect(parseLabelLines([
      '1st Place Time: 1:02.34',
      '',
      'Skywalker, Luke (12)',
      'Jedi Swim Academy – Jun 8, 2025',
      'Coruscant Cup 2025',
    ])).toBeNull();
  });

  it('returns null when the place line does not match', () => {
    expect(parseLabelLines([
      'Not a valid place line',
      '#1 Boys 12&U 100m IM',
      'Skywalker, Luke (12)',
      'Jedi Swim Academy – Jun 8, 2025',
      'Coruscant Cup 2025',
    ])).toBeNull();
  });

  it('returns null when the event line does not match', () => {
    expect(parseLabelLines([
      '1st Place Time: 1:02.34',
      'Not an event line',
      'Skywalker, Luke (12)',
      'Jedi Swim Academy – Jun 8, 2025',
      'Coruscant Cup 2025',
    ])).toBeNull();
  });

  it('returns null when the swimmer line does not match', () => {
    expect(parseLabelLines([
      '1st Place Time: 1:02.34',
      '#1 Boys 12&U 100m IM',
      'Not a swimmer line',
      'Jedi Swim Academy – Jun 8, 2025',
      'Coruscant Cup 2025',
    ])).toBeNull();
  });
});
