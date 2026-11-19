import asyncio
import io
import logging
import re
from contextlib import suppress

from PIL import Image
from pymobiledevice3 import usbmux
from pymobiledevice3.exceptions import (
    AlreadyMountedError,
    DeviceNotFoundError,
    NoDeviceConnectedError,
    NotPairedError,
    PairingError,
    PasswordRequiredError,
)
from pymobiledevice3.lockdown import create_using_usbmux
from pymobiledevice3.remote.core_device.display_service import DisplayService, is_media_in_use_error
from pymobiledevice3.remote.userspace_tunnel import UserspaceRsdTunnel
from pymobiledevice3.services.dvt.instruments.dvt_provider import DvtProvider
from pymobiledevice3.services.dvt.instruments.screenshot import Screenshot
from pymobiledevice3.services.mobile_image_mounter import auto_mount


class CaptureError(Exception):
    pass


def decode_snapshot(data):
    with Image.open(io.BytesIO(data)) as frame:
        frame.thumbnail((1200, 1200), Image.Resampling.BILINEAR)
        return frame.convert("RGB")


def capture_mode(version: str) -> str:
    match = re.fullmatch(r"(\d+)\.(\d+)(?:\.\d+)?", version)
    if not match:
        raise CaptureError("O iPhone não informou uma versão válida do iOS.")
    major, minor = map(int, match.groups())
    if (major, minor) < (17, 4):
        raise CaptureError("A visualização por USB exige iOS 17.4 ou mais recente.")
    return "live" if major >= 27 else "snapshots"


async def list_usb():
    async with asyncio.timeout(8):
        devices = await usbmux.list_devices()
    return sorted({device.serial for device in devices if device.is_usb})


async def view(serial, status, show, on_input, on_input_error):
    from live_video import stream_video

    stage = "identificação do iPhone"
    try:
        status("Desbloqueie o iPhone. Toque em Confiar se ele solicitar.")
        async with asyncio.timeout(30):
            async with await create_using_usbmux(serial=serial, connection_type="USB", pair_timeout=24) as phone:
                version = phone.product_version
                mode = capture_mode(version)
                if not await phone.get_developer_mode_status():
                    raise CaptureError(
                        "Ative Modo de Desenvolvedor em Ajustes → Privacidade e Segurança. "
                        "Após reiniciar e confirmar no iPhone, clique em Ver tela."
                    )

        def new_tunnel():
            return UserspaceRsdTunnel(serial=serial, autopair=False, remotepairing_fallback=False)

        stage = "conexão de captura pelo USB"
        status(f"iOS {version} · abrindo conexão de captura pelo USB…")
        tunnel = new_tunnel()
        try:
            rsd = await asyncio.wait_for(tunnel.aopen(), 35)
            if mode == "live":
                if DisplayService.SERVICE_NAME not in rsd.peer_info.get("Services", {}):
                    stage = "preparação da imagem de desenvolvimento"
                    status("Preparando a imagem de desenvolvimento do iOS. A primeira vez pode demorar e requer internet.")
                    with suppress(AlreadyMountedError):
                        await asyncio.wait_for(auto_mount(rsd), 240)
                    await tunnel.aclose()
                    tunnel = new_tunnel()
                    rsd = await asyncio.wait_for(tunnel.aopen(), 35)
                    if DisplayService.SERVICE_NAME not in rsd.peer_info.get("Services", {}):
                        raise CaptureError(
                            "O iOS não ofereceu o serviço de vídeo após preparar a imagem. "
                            "Reinicie o iPhone, confirme o Modo de Desenvolvedor e tente de novo."
                        )
                stage = "vídeo do iPhone"
                status(f"iOS {version} · aguardando o primeiro quadro de vídeo…")
                await stream_video(
                    rsd, lambda frame, rotation: show(frame, f"iOS {version} · vídeo ao vivo via USB", rotation),
                    on_input, on_input_error,
                )
            else:
                stage = "captura Instruments"
                status(f"iOS {version} · aguardando a primeira captura…")
                async with asyncio.timeout(20):
                    provider = DvtProvider(rsd)
                    await provider.connect()
                try:
                    screenshot = Screenshot(provider)
                    await asyncio.wait_for(screenshot.connect(), 15)
                    clock = asyncio.get_running_loop().time
                    while True:
                        started = clock()
                        data = await asyncio.wait_for(screenshot.get_screenshot(), 12)
                        frame = await asyncio.to_thread(decode_snapshot, data)
                        show(frame, f"iOS {version} · capturas sucessivas via USB · somente visualização", 0)
                        # Pace the start of each request rather than waiting after it has finished.
                        await asyncio.sleep(max(0, 0.18 - (clock() - started)))
                finally:
                    await provider.close()
        finally:
            await tunnel.aclose()
    except CaptureError:
        raise
    except (NoDeviceConnectedError, DeviceNotFoundError, ConnectionResetError, BrokenPipeError) as exc:
        raise CaptureError("O iPhone deixou de responder pelo USB. Confira o cabo e clique em Buscar iPhones.") from exc
    except PasswordRequiredError as exc:
        raise CaptureError("Desbloqueie o iPhone e tente novamente.") from exc
    except (PairingError, NotPairedError) as exc:
        raise CaptureError("O pareamento precisa ser confirmado no iPhone. Desbloqueie e toque em Confiar.") from exc
    except TimeoutError as exc:
        logging.warning("Tempo excedido em %s", stage)
        raise CaptureError(f"Tempo excedido durante {stage}. Mantenha o iPhone desbloqueado e tente de novo.") from exc
    except Exception as exc:
        logging.warning("Falha em %s (%s)", stage, type(exc).__name__)
        if is_media_in_use_error(exc):
            raise CaptureError("Feche no iPhone qualquer app usando câmera ou microfone e tente novamente.") from exc
        raise CaptureError(f"Falha durante {stage} ({type(exc).__name__}). Confira a conexão e tente de novo.") from exc
