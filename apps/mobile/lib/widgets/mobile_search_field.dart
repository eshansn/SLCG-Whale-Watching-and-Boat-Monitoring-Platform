import 'package:flutter/material.dart';

const mobileSearchTextStyle = TextStyle(
  color: Color(0xFF334155),
  fontSize: 14,
  fontWeight: FontWeight.w400,
);

const _searchBorder = OutlineInputBorder(
  borderRadius: BorderRadius.all(Radius.circular(6)),
  borderSide: BorderSide(color: Color(0xFFE2E8F0)),
);

InputDecoration mobileSearchDecoration(String hintText) => InputDecoration(
      isDense: true,
      filled: true,
      fillColor: Colors.white,
      hintText: hintText,
      hintStyle: const TextStyle(
        color: Color(0xFF94A3B8),
        fontSize: 14,
        fontWeight: FontWeight.w400,
      ),
      prefixIcon: const Icon(
        Icons.search,
        size: 16,
        color: Color(0xFF94A3B8),
      ),
      prefixIconConstraints: const BoxConstraints(minWidth: 36, minHeight: 40),
      contentPadding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      border: _searchBorder,
      enabledBorder: _searchBorder,
      disabledBorder: _searchBorder,
      focusedBorder: const OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(6)),
        borderSide: BorderSide(color: Color(0xFF818CF8)),
      ),
    );
