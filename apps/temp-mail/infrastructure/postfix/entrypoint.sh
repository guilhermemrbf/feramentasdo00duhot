#!/bin/sh
set -eu
size=${MAX_MESSAGE_SIZE:-2097152}
case "$size" in ''|*[!0-9]*) echo "MAX_MESSAGE_SIZE inválido" >&2; exit 1;; esac
[ "$size" -ge 1024 ] && [ "$size" -le 10485760 ] || exit 1
printf '%s\n' "${SMTP_HOST:-mx.mail.test}" | grep -Eq '^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z0-9]+$'
postconf -e "myhostname=${SMTP_HOST:-mx.mail.test}" \
  'mydestination=' 'relay_domains=' 'mynetworks=127.0.0.0/8' 'inet_interfaces=all' \
  'inet_protocols=ipv4' 'smtpd_sasl_auth_enable=no' \
  'smtpd_relay_restrictions=reject_unauth_destination' \
  'smtpd_recipient_restrictions=reject_unlisted_recipient' \
  'smtpd_reject_unlisted_recipient=yes' 'disable_vrfy_command=yes' \
  'virtual_mailbox_domains=socketmap:inet:ingest:10027:domains' \
  'virtual_mailbox_maps=socketmap:inet:ingest:10027:recipients' \
  'virtual_alias_maps=' 'recipient_delimiter=' \
  'virtual_transport=smtp:[ingest]:2525' 'smtp_destination_recipient_limit=1' \
  'default_transport=error:outbound disabled' 'relay_transport=error:relay disabled' \
  'smtpd_client_connection_count_limit=20' 'smtpd_client_message_rate_limit=120' \
  'smtpd_client_recipient_rate_limit=180' 'smtpd_client_event_limit_exceptions=' \
  'bounce_queue_lifetime=0' 'maximal_queue_lifetime=1d' \
  "message_size_limit=$size" 'maillog_file=/dev/stdout'
postconf -F smtp/inet/chroot=n smtp/unix/chroot=n
if [ "${SMTP_TLS:-0}" = 1 ]; then
  test -r /run/smtp-tls/fullchain.pem && test -r /run/smtp-tls/privkey.pem
  postconf -e 'smtpd_tls_security_level=may' 'smtpd_tls_cert_file=/run/smtp-tls/fullchain.pem' \
    'smtpd_tls_key_file=/run/smtp-tls/privkey.pem' 'smtpd_tls_mandatory_protocols=>=TLSv1.2' 'smtpd_tls_protocols=>=TLSv1.2'
fi
exec postfix start-fg
