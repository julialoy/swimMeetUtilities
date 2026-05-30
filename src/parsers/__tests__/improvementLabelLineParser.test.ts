import { describe, it, expect } from 'vitest';
import { parseLabelLines } from '../improvementLabelLineParser';

describe('parseLabelLines', () => {
  it('parses a standard over-a-minute time', () => {
    const label = parseLabelLines([
      '#1 Boys 12&U 100m IM',
      'Skywalker, Luke (12)',
      'Personal Best: 1:51.56 (-14.13)',
      'Jedi Swim Academy – Jun 1, 2025',
      'Bespin Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.eventNumber).toBe('1');
    expect(label!.eventDescription).toBe('Boys 12&U 100m IM');
    expect(label!.lastName).toBe('Skywalker');
    expect(label!.firstName).toBe('Luke');
    expect(label!.age).toBe(12);
    expect(label!.personalBestTime).toBe('1:51.56');
    expect(label!.improvement).toBe(-14.13);
    expect(label!.team).toBe('Jedi Swim Academy');
    expect(label!.date).toBe('Jun 1, 2025');
    expect(label!.meetName).toBe('Bespin Cup 2025');
  });

  it('parses a sub-minute time', () => {
    const label = parseLabelLines([
      '#7B Boys 7-8 25m Free',
      'Solo, Han (8)',
      'Personal Best: 25.31 (-4.77)',
      'Jedi Swim Academy – Jun 1, 2025',
      'Bespin Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.eventNumber).toBe('7B');
    expect(label!.personalBestTime).toBe('25.31');
    expect(label!.improvement).toBe(-4.77);
  });

  it('parses an event number with a letter suffix', () => {
    const label = parseLabelLines([
      '#17A Boys 6&U 25m Back',
      'Tano, TJ (6)',
      'Personal Best: 38.02 (-10.01)',
      'Jedi Swim Academy – Jun 1, 2025',
      'Bespin Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.eventNumber).toBe('17A');
    expect(label!.eventDescription).toBe('Boys 6&U 25m Back');
    expect(label!.firstName).toBe('TJ');
    expect(label!.age).toBe(6);
  });

  it('parses a hyphenated last name', () => {
    const label = parseLabelLines([
      '#3 Boys 13-14 100m IM',
      'Fett-Wren, Paz (13)',
      'Personal Best: 1:42.06 (-5.69)',
      'Jedi Swim Academy – Jun 1, 2025',
      'Bespin Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.lastName).toBe('Fett-Wren');
    expect(label!.firstName).toBe('Paz');
  });

  it('parses a doubly-hyphenated last name', () => {
    const label = parseLabelLines([
      '#6 Women 15-18 100m IM',
      'Kryze-Wren-Djarin, Bo (16)',
      'Personal Best: 1:18.62 (-5.88)',
      'Jedi Swim Academy – Jun 1, 2025',
      'Bespin Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.lastName).toBe('Kryze-Wren-Djarin');
    expect(label!.firstName).toBe('Bo');
  });

  it('parses a large improvement value', () => {
    const label = parseLabelLines([
      '#22 Girls 11-12 50m Back',
      'Organa, Leia (11)',
      'Personal Best: 1:19.76 (-35.13)',
      'Jedi Swim Academy – Jun 1, 2025',
      'Bespin Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.improvement).toBe(-35.13);
  });

  it('parses a multi-word first name', () => {
    const label = parseLabelLines([
      '#18B Girls 7-8 25m Back',
      'Wan Kenobi, Obi Dee (7)',
      'Personal Best: 36.52 (-9.10)',
      'Jedi Swim Academy – Jun 1, 2025',
      'Bespin Cup 2025',
    ]);
    expect(label).not.toBeNull();
    expect(label!.lastName).toBe('Wan Kenobi');
    expect(label!.firstName).toBe('Obi Dee');
  });

  it('returns null when fewer than 5 lines are provided', () => {
    expect(parseLabelLines([
      '#1 Boys 12&U 100m IM',
      'Skywalker, Luke (12)',
    ])).toBeNull();
  });

  it('returns null when any line is empty', () => {
    expect(parseLabelLines([
      '#1 Boys 12&U 100m IM',
      '',
      'Personal Best: 1:51.56 (-14.13)',
      'Jedi Swim Academy – Jun 1, 2025',
      'Bespin Cup 2025',
    ])).toBeNull();
  });

  it('returns null when the Personal Best line does not match', () => {
    expect(parseLabelLines([
      '#1 Boys 12&U 100m IM',
      'Skywalker, Luke (12)',
      'Not a valid line',
      'Jedi Swim Academy – Jun 1, 2025',
      'Bespin Cup 2025',
    ])).toBeNull();
  });
});
