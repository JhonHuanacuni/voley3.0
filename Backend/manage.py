#!/usr/bin/env python
import os
import sys


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'voley_project.settings')
    from django.core.management import execute_from_command_line
    from django.core.management.commands.runserver import Command as RunserverCommand

    # El proxy de Vite apunta al 8001; el 8000 lo usa Kaysen.
    RunserverCommand.default_port = '8001'
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
