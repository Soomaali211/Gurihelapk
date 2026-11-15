// ============================================================================
// GURIHEL FLUTTER 3.x - PRICE MARKER PAINTER
// Verbatim code from Section 10.5 of Full Stack Blueprint v1.0
// ============================================================================

import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

Future<BitmapDescriptor> priceMarker(
  String label, {
  bool verified = false,
  bool featured = false,
}) async {
  final rec = ui.PictureRecorder();
  final c = Canvas(rec);
  final bg = Paint()
    ..color = featured ? const Color(0xFFF5B800) : const Color(0xFF0B7A3E);
  final tp = TextPainter(
    text: TextSpan(
      text: label,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 28,
        fontWeight: FontWeight.w700,
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();

  final w = tp.width + (verified ? 64 : 32), h = tp.height + 20;
  c.drawRRect(
    RRect.fromLTRBR(0, 0, w, h, const Radius.circular(14)),
    bg,
  );

  if (verified) {
    // Draw white verification checkmark badge icon
    final checkPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 3.5
      ..style = PaintingStyle.stroke;
    final path = Path()
      ..moveTo(14, 20)
      ..lineTo(22, 28)
      ..lineTo(36, 14);
    c.drawPath(path, checkPaint);
  }

  tp.paint(c, Offset(verified ? 48 : 16, 10));
  final img = await rec.endRecording().toImage(w.ceil(), (h + 12).ceil());
  final bytes = (await img.toByteData(format: ui.ImageByteFormat.png))!
      .buffer
      .asUint8List();
  return BitmapDescriptor.fromBytes(bytes);
}
