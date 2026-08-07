import 'package:flutter/material.dart';

/// Website default: public/authentication, passenger, and Boat Owner pages.
ThemeData withWebsiteMontserrat(ThemeData theme) => theme.copyWith(
      textTheme: theme.textTheme.apply(fontFamily: 'Montserrat'),
      primaryTextTheme: theme.primaryTextTheme.apply(fontFamily: 'Montserrat'),
    );

/// Website portals: Shore, Wildlife Shore, and Boat Crew pages.
ThemeData withWebsitePoppins(ThemeData theme) => theme.copyWith(
      textTheme: theme.textTheme.apply(fontFamily: 'Poppins'),
      primaryTextTheme: theme.primaryTextTheme.apply(fontFamily: 'Poppins'),
    );
