export interface Task {
  id: string;
  project: string;
  title: string;
  done: boolean;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string;
  note_type: string;
  created_at: string;
  updated_at: string;
}

export interface ClipboardEntry {
  id: string;
  content: string;
  content_type: string;
  created_at: string;
}

export interface Schedule {
  id: string;
  title: string;
  scheduled_at: string;
  reminder_minutes: number;
  done: boolean;
  created_at: string;
}

export interface Alarm {
  id: string;
  time: string;
  label: string;
  repeat: string;
  active: boolean;
  created_at: string;
}

export interface PomodoroState {
  is_running: boolean;
  is_break: boolean;
  remaining_seconds: number;
  work_duration: number;
  break_duration: number;
  completed_count: number;
}

export interface CommandItem {
  id: string;
  name: string;
  description: string;
  icon?: string;
  action: () => void;
}

export interface MysqlUser {
  id: string;
  username: string;
  password: string;
  databases: string;
  created_at: string;
}
