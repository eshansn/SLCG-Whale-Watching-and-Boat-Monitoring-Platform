import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/api_service.dart';
import 'owner_portal_common.dart';

class OwnerNewBoatScreen extends StatefulWidget {
  const OwnerNewBoatScreen({super.key});

  @override
  State<OwnerNewBoatScreen> createState() => _OwnerNewBoatScreenState();
}

class _SelectedOwnerFile {
  final String name;
  final String contentType;
  final Uint8List bytes;

  const _SelectedOwnerFile(this.name, this.contentType, this.bytes);
}

class _OwnerCertificate {
  final String name;
  _SelectedOwnerFile? file;

  _OwnerCertificate(this.name);
}

class _OwnerNewBoatScreenState extends State<OwnerNewBoatScreen> {
  final _api = ApiService.instance;
  final _name = TextEditingController();
  final _registration = TextEditingController();
  final _capacity = TextEditingController();
  final _length = TextEditingController();
  final _hull = TextEditingController();
  final _width = TextEditingController();
  final _speed = TextEditingController();
  final _lifeJackets = TextEditingController();
  final _certificates = [
    _OwnerCertificate('Certificate of registration of Sole Proprietorship'),
    _OwnerCertificate('ME Certificate'),
    _OwnerCertificate('Certificate of Vessel'),
    _OwnerCertificate('Wildlife Certificate'),
    _OwnerCertificate('Coxswain Certificate'),
    _OwnerCertificate('Vessel Registration Certificate'),
  ];

  DateTime? _registrationDate;
  _SelectedOwnerFile? _photo;
  bool _submitting = false;
  String? _status;

  @override
  void dispose() {
    for (final controller in [
      _name,
      _registration,
      _capacity,
      _length,
      _hull,
      _width,
      _speed,
      _lifeJackets,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  String _contentType(String extension) => switch (extension.toLowerCase()) {
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'webp' => 'image/webp',
        'jpg' || 'jpeg' => 'image/jpeg',
        _ => 'application/octet-stream',
      };

  Future<_SelectedOwnerFile?> _pick({required bool imageOnly}) async {
    final result = await FilePicker.pickFiles(
      type: imageOnly ? FileType.image : FileType.custom,
      allowedExtensions: imageOnly ? null : const ['pdf', 'jpg', 'jpeg', 'png'],
      withData: true,
    );
    final file = result?.files.single;
    if (file == null || file.bytes == null) return null;
    return _SelectedOwnerFile(
      file.name,
      _contentType(file.extension ?? ''),
      file.bytes!,
    );
  }

  Future<void> _pickPhoto() async {
    final file = await _pick(imageOnly: true);
    if (file == null) return;
    if (!file.contentType.startsWith('image/')) {
      _setStatus('Please select a valid image of the boat.');
      return;
    }
    setState(() {
      _photo = file;
      _status = null;
    });
  }

  Future<void> _pickCertificate(_OwnerCertificate certificate) async {
    final file = await _pick(imageOnly: false);
    if (file == null) return;
    if (file.bytes.isEmpty || file.bytes.length > 10 * 1024 * 1024) {
      _setStatus('Certificate must be between 1 byte and 10 MB.');
      return;
    }
    setState(() {
      certificate.file = file;
      _status = null;
    });
  }

  void _setStatus(String message) => setState(() => _status = message);

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      initialDate: _registrationDate ?? DateTime.now(),
    );
    if (date != null && mounted) {
      setState(() {
        _registrationDate = date;
        _status = null;
      });
    }
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (_photo == null) {
      _setStatus('Please upload a photograph of the boat.');
      return;
    }
    if (_name.text.trim().isEmpty) {
      _setStatus('Please enter the boat name.');
      return;
    }
    if (_registration.text.trim().isEmpty) {
      _setStatus('Please enter the registration number.');
      return;
    }
    if (_registrationDate == null) {
      _setStatus('Please select the registration date.');
      return;
    }
    final capacity = int.tryParse(
        _capacity.text.trim().isEmpty ? '0' : _capacity.text.trim());
    final length = double.tryParse(
        _length.text.trim().isEmpty ? '0' : _length.text.trim());
    final width =
        double.tryParse(_width.text.trim().isEmpty ? '0' : _width.text.trim());
    final speed =
        double.tryParse(_speed.text.trim().isEmpty ? '0' : _speed.text.trim());
    final jackets = int.tryParse(
        _lifeJackets.text.trim().isEmpty ? '0' : _lifeJackets.text.trim());
    if (capacity == null ||
        capacity < 0 ||
        length == null ||
        length < 0 ||
        width == null ||
        width < 0 ||
        speed == null ||
        speed < 0 ||
        jackets == null ||
        jackets < 0) {
      _setStatus('Enter valid non-negative vessel measurements and counts.');
      return;
    }
    setState(() {
      _submitting = true;
      _status = 'Submitting your boat approval request...';
    });
    try {
      final photoUrl =
          'data:${_photo!.contentType};base64,${base64Encode(_photo!.bytes)}';
      final created = await _api.createOwnerBoat({
        'name': _name.text.trim(),
        'registrationNumber': _registration.text.trim(),
        'registrationDate': DateFormat('yyyy-MM-dd').format(_registrationDate!),
        'hullNumber': _hull.text.trim(),
        'lengthMeters': length,
        'widthMeters': width,
        'maximumCapacity': capacity,
        'imageUrl': photoUrl,
        'maximumSpeedKnots': speed,
        'lifeJacketCount': jackets,
      });
      final boatId = created['id']?.toString();
      if (boatId == null || boatId.isEmpty) {
        throw Exception('The server did not return the registered boat ID.');
      }
      for (final certificate in _certificates) {
        final file = certificate.file;
        if (file == null) continue;
        await _api.uploadBoatDocument(
          boatId,
          certificate.name,
          file.bytes,
          file.name,
          file.contentType,
        );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content:
              Text('Your boat approval request was submitted successfully.')));
      Navigator.pushReplacementNamed(context, '/owner_boat_info',
          arguments: boatId);
    } catch (error) {
      if (mounted) _setStatus(ownerError(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(title: const Text('New Boat')),
        body: SafeArea(
          top: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 36),
            children: [
              const Text('Photograph of the Boat',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 9),
              InkWell(
                borderRadius: BorderRadius.circular(18),
                onTap: _submitting ? null : _pickPhoto,
                child: Container(
                  height: 200,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF8FB3E5), Color(0xFFBCE8F4)],
                    ),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: _photo == null
                      ? const Center(
                          child: Icon(Icons.attach_file_rounded,
                              size: 62, color: Colors.white))
                      : Stack(
                          fit: StackFit.expand,
                          children: [
                            Image.memory(_photo!.bytes, fit: BoxFit.cover),
                            const Positioned(
                              right: 10,
                              bottom: 10,
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  color: Colors.black54,
                                  borderRadius:
                                      BorderRadius.all(Radius.circular(8)),
                                ),
                                child: Padding(
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 7),
                                  child: Text('Change photo',
                                      style: TextStyle(color: Colors.white)),
                                ),
                              ),
                            ),
                          ],
                        ),
                ),
              ),
              _field(_name, 'Name', hint: 'Enter the boat name'),
              _field(_registration, 'Registration No.',
                  hint: 'Registration number'),
              _dateField(),
              _responsivePair(
                _field(_capacity, 'Maximum Capacity',
                    number: true, hint: 'Maximum capacity'),
                _field(_length, 'Boat Length',
                    decimal: true, hint: 'Boat length', suffix: 'm'),
              ),
              _responsivePair(
                _field(_hull, 'Hull Number', hint: 'Hull number'),
                _field(_width, 'Boat Width',
                    decimal: true, hint: 'Boat width', suffix: 'm'),
              ),
              _responsivePair(
                _field(_speed, 'Maximum Speed', decimal: true, suffix: 'knots'),
                _field(_lifeJackets, 'Life Jackets', number: true),
              ),
              const SizedBox(height: 20),
              const Text('Certifications',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
              const SizedBox(height: 9),
              OwnerCard(
                child: Column(
                  children: _certificates
                      .map((certificate) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(certificate.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w500)),
                            subtitle: certificate.file == null
                                ? null
                                : Text(certificate.file!.name,
                                    overflow: TextOverflow.ellipsis),
                            trailing: IconButton(
                              tooltip: certificate.file == null
                                  ? 'Upload certificate'
                                  : 'Remove certificate',
                              onPressed: _submitting
                                  ? null
                                  : certificate.file == null
                                      ? () => _pickCertificate(certificate)
                                      : () => setState(
                                          () => certificate.file = null),
                              icon: Icon(certificate.file == null
                                  ? Icons.upload_outlined
                                  : Icons.delete_outline_rounded),
                            ),
                          ))
                      .toList(),
                ),
              ),
              if (_status != null) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(_status!, textAlign: TextAlign.center),
                ),
              ],
              const SizedBox(height: 20),
              SizedBox(
                height: 54,
                child: FilledButton.icon(
                  onPressed: _submitting ? null : _submit,
                  icon: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send_rounded),
                  label:
                      Text(_submitting ? 'Submitting...' : 'Request Approval'),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _field(TextEditingController controller, String label,
          {String? hint,
          bool number = false,
          bool decimal = false,
          String? suffix}) =>
      Padding(
        padding: const EdgeInsets.only(top: 15),
        child: TextField(
          controller: controller,
          enabled: !_submitting,
          keyboardType: number || decimal
              ? TextInputType.numberWithOptions(decimal: decimal)
              : TextInputType.text,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            suffixText: suffix,
            border: const OutlineInputBorder(),
          ),
        ),
      );

  Widget _dateField() => Padding(
        padding: const EdgeInsets.only(top: 15),
        child: InkWell(
          onTap: _submitting ? null : _pickDate,
          child: InputDecorator(
            decoration: const InputDecoration(
              labelText: 'Registration Date',
              suffixIcon: Icon(Icons.calendar_today_outlined),
              border: OutlineInputBorder(),
            ),
            child: Text(_registrationDate == null
                ? 'Select registration date'
                : DateFormat('MMM d, y').format(_registrationDate!)),
          ),
        ),
      );

  Widget _responsivePair(Widget first, Widget second) => LayoutBuilder(
        builder: (context, constraints) => constraints.maxWidth >= 520
            ? Row(children: [
                Expanded(child: first),
                const SizedBox(width: 14),
                Expanded(child: second),
              ])
            : Column(children: [first, second]),
      );
}
