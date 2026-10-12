// ### Imports ###

/* eslint-disable testing-library/no-container, testing-library/no-node-access, testing-library/prefer-screen-queries */

import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Circle } from "./Circle";
import { ToolTip } from "./ToolTip";
import SystemStore from "../SystemStore";

// ### Store setup ###

beforeEach(() => {
    act(() => {
        SystemStore.setState({
            circleProperties: {
                active: false,
                pinnedCircleName: undefined
            },
            circlesData: [],
            currentCircleNameSelected: undefined,
            viewerBounds: {
                left: 100,
                top: 50,
                width: 400,
                height: 200
            }
        });
    });
});

// ### Circle presentation ###

test("renders a centered pulsating tour circle at viewer coordinates", () => {
    const { getByRole, rerender } = render(
        <Circle
            circleName="tour-circle"
            circleIsVisible
            circleSize={24}
            playPulseAnimation
            position={[25, 75]}
            housemakerTourCircle
            ariaLabel="Tour hotspot"
        />
    );
    const circle = getByRole("button", { name: "Tour hotspot" });

    expect(circle).toHaveStyle({
        left: "200px",
        top: "200px",
        width: "24px",
        height: "24px",
        transform: "translate(-50%, -50%)",
        animation: "pulsate 2s infinite ease-in-out",
        opacity: "1",
        pointerEvents: "auto"
    });
    expect(circle).toHaveAttribute("data-housemaker-tour-interaction", "true");
    expect(circle).toHaveAttribute("tabindex", "0");
    expect(circle).toHaveAttribute("aria-hidden", "false");

    rerender(
        <Circle
            circleName="tour-circle"
            circleIsVisible={false}
            circleSize={24}
            playPulseAnimation
            position={[25, 75]}
            housemakerTourCircle
            ariaLabel="Tour hotspot"
        />
    );

    expect(circle).toHaveStyle({ opacity: "0", pointerEvents: "none" });
    expect(circle).not.toHaveAttribute("tabindex");
    expect(circle).toHaveAttribute("aria-hidden", "true");
});

// ### Circle selection ###

test("hover selects tour circles and restores the pinned circle", () => {
    const { getByRole } = render(
        <>
            <Circle
                circleName="tour-a"
                circleIsVisible
                housemakerTourCircle
                ariaLabel="Tour A"
            />
            <Circle
                circleName="tour-b"
                circleIsVisible
                housemakerTourCircle
                ariaLabel="Tour B"
            />
        </>
    );
    const circleA = getByRole("button", { name: "Tour A" });
    const circleB = getByRole("button", { name: "Tour B" });

    fireEvent.click(circleA);
    expect(SystemStore.getState().circleProperties).toMatchObject({
        active: true,
        pinnedCircleName: "tour-a"
    });
    expect(SystemStore.getState().currentCircleNameSelected).toBe("tour-a");
    expect(circleA).toHaveAttribute("aria-pressed", "true");

    fireEvent.mouseEnter(circleB);
    expect(SystemStore.getState().currentCircleNameSelected).toBe("tour-b");
    expect(circleB).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseLeave(circleB);
    expect(SystemStore.getState().currentCircleNameSelected).toBe("tour-a");
    expect(SystemStore.getState().circleProperties.active).toBe(true);

    fireEvent.click(circleA);
    expect(SystemStore.getState().circleProperties).toMatchObject({
        active: false,
        pinnedCircleName: undefined
    });
    expect(SystemStore.getState().currentCircleNameSelected).toBeUndefined();
});

test("keyboard focus reveals and pins a tour circle", () => {
    const { getByRole } = render(
        <Circle
            circleName="keyboard-tour"
            circleIsVisible
            housemakerTourCircle
            ariaLabel="Keyboard tour"
        />
    );
    const circle = getByRole("button", { name: "Keyboard tour" });

    fireEvent.focus(circle);
    expect(SystemStore.getState().currentCircleNameSelected).toBe("keyboard-tour");
    expect(SystemStore.getState().circleProperties.active).toBe(true);

    fireEvent.keyDown(circle, { key: "Escape" });
    expect(SystemStore.getState().circleProperties.pinnedCircleName).toBeUndefined();

    fireEvent.keyDown(circle, { key: "Enter" });
    expect(SystemStore.getState().circleProperties.pinnedCircleName).toBe("keyboard-tour");
    expect(circle).toHaveAttribute("aria-pressed", "true");

    fireEvent.blur(circle);
    expect(SystemStore.getState().currentCircleNameSelected).toBe("keyboard-tour");
    expect(SystemStore.getState().circleProperties.active).toBe(true);

    fireEvent.focus(circle);
    fireEvent.keyDown(circle, { key: " " });
    expect(SystemStore.getState().circleProperties.pinnedCircleName).toBeUndefined();
    expect(SystemStore.getState().circleProperties.active).toBe(true);

    fireEvent.blur(circle);
    expect(SystemStore.getState().currentCircleNameSelected).toBeUndefined();
    expect(SystemStore.getState().circleProperties.active).toBe(false);
});

test("a hidden focused circle releases selection and cannot repin", () => {
    const view = render(
        <Circle
            circleName="hidden-tour"
            circleIsVisible
            housemakerTourCircle
            ariaLabel="Hidden tour"
        />
    );
    const circle = view.getByRole("button", { name: "Hidden tour" });

    fireEvent.focus(circle);
    fireEvent.keyDown(circle, { key: "Enter" });
    expect(SystemStore.getState().circleProperties.pinnedCircleName).toBe("hidden-tour");

    view.rerender(
        <Circle
            circleName="hidden-tour"
            circleIsVisible={false}
            housemakerTourCircle
            ariaLabel="Hidden tour"
        />
    );
    expect(SystemStore.getState()).toMatchObject({
        currentCircleNameSelected: undefined,
        circleProperties: {
            active: false,
            pinnedCircleName: undefined
        }
    });
    expect(circle).not.toHaveFocus();

    fireEvent.keyDown(circle, { key: "Enter" });
    expect(SystemStore.getState().circleProperties.pinnedCircleName).toBeUndefined();
});

test("legacy circles retain hover-only selection behavior", () => {
    const { container } = render(
        <Circle
            circleName="legacy-circle"
            circleIsVisible
            position={[50, 50]}
        />
    );
    const circle = container.firstChild;

    expect(circle).not.toHaveAttribute("data-housemaker-tour-interaction");
    expect(circle).not.toHaveAttribute("role");
    expect(circle).not.toHaveStyle({ transform: "translate(-50%, -50%)" });

    fireEvent.mouseEnter(circle);
    expect(SystemStore.getState().currentCircleNameSelected).toBe("legacy-circle");
    expect(SystemStore.getState().circleProperties.active).toBe(true);

    fireEvent.mouseLeave(circle);
    expect(SystemStore.getState().currentCircleNameSelected).toBeUndefined();
    expect(SystemStore.getState().circleProperties.active).toBe(false);
});

test("legacy hover restores a pinned tour circle on leave", () => {
    const { getByRole, getByTestId } = render(
        <>
            <Circle
                circleName="pinned-tour"
                circleIsVisible
                housemakerTourCircle
                ariaLabel="Pinned tour"
            />
            <div data-testid="legacy-wrapper">
                <Circle circleName="legacy-circle" circleIsVisible />
            </div>
        </>
    );
    const tourCircle = getByRole("button", { name: "Pinned tour" });
    const legacyCircle = getByTestId("legacy-wrapper").firstChild;

    fireEvent.click(tourCircle);
    fireEvent.mouseEnter(legacyCircle);
    expect(SystemStore.getState().currentCircleNameSelected).toBe("legacy-circle");

    fireEvent.mouseLeave(legacyCircle);
    expect(SystemStore.getState()).toMatchObject({
        currentCircleNameSelected: "pinned-tour",
        circleProperties: {
            active: true,
            pinnedCircleName: "pinned-tour"
        }
    });
});

// ### Tooltip content and placement ###

test("renders authored tooltip HTML and React styles", () => {
    const { getByRole } = render(
        <ToolTip
            active
            html="<h2>Door details</h2><p><strong>Oak finish</strong></p>"
            style={{
                width: "280px",
                padding: "12px",
                backgroundColor: "rgb(10, 20, 30)",
                borderRadius: "9px"
            }}
            selectedCirclePositionX={75}
            viewerBounds={{ left: 100, top: 50, width: 400, height: 200 }}
        />
    );
    const tooltip = getByRole("tooltip");

    expect(tooltip.querySelector("h2")).toHaveTextContent("Door details");
    expect(tooltip.querySelector("strong")).toHaveTextContent("Oak finish");
    expect(tooltip).toHaveStyle({
        width: "280px",
        padding: "12px",
        backgroundColor: "rgb(10, 20, 30)",
        borderRadius: "9px",
        top: "60px",
        opacity: "1"
    });
    expect(tooltip).toHaveAttribute("aria-hidden", "false");
});

test("places tooltips explicitly or opposite the selected circle", () => {
    const viewerBounds = { left: 100, top: 50, width: 400, height: 200 };
    let view = render(
        <ToolTip
            active
            tooltipPosition="left"
            selectedCirclePositionX={25}
            viewerBounds={viewerBounds}
        />
    );
    let tooltip = view.getByRole("tooltip");

    expect(tooltip.style.left).toBe("110px");
    expect(tooltip.style.right).toBe("");

    view.unmount();
    view = render(
        <ToolTip
            active
            tooltipPosition="right"
            selectedCirclePositionX={75}
            viewerBounds={viewerBounds}
        />
    );
    tooltip = view.getByRole("tooltip");
    expect(tooltip.style.left).toBe("");
    expect(tooltip.style.right).toBe("calc(100vw - 490px)");

    view.unmount();
    view = render(
        <ToolTip
            active
            tooltipPosition="opposite"
            selectedCirclePositionX={25}
            viewerBounds={viewerBounds}
        />
    );
    tooltip = view.getByRole("tooltip");
    expect(tooltip.style.left).toBe("");
    expect(tooltip.style.right).toBe("calc(100vw - 490px)");

    view.unmount();
    view = render(
        <ToolTip
            active
            tooltipPosition="opposite"
            selectedCirclePositionX={75}
            viewerBounds={viewerBounds}
        />
    );
    tooltip = view.getByRole("tooltip");
    expect(tooltip.style.left).toBe("110px");
    expect(tooltip.style.right).toBe("");
});

test("marks tour tooltips and enables pointer input only while pinned", () => {
    const sharedProps = {
        html: "<p>Interactive tooltip</p>",
        selectedCirclePositionX: 25,
        viewerBounds: { left: 0, top: 0, width: 800, height: 600 }
    };
    const { getByRole, rerender } = render(
        <ToolTip
            {...sharedProps}
            active
            housemakerTourCircle
            pinned
        />
    );
    const tooltip = getByRole("tooltip");

    expect(tooltip).toHaveAttribute("data-housemaker-tour-interaction", "true");
    expect(tooltip).toHaveStyle({ pointerEvents: "auto" });
    expect(tooltip).not.toHaveAttribute("inert");

    rerender(
        <ToolTip
            {...sharedProps}
            active
            housemakerTourCircle
            pinned={false}
        />
    );
    expect(tooltip).toHaveStyle({ pointerEvents: "none" });

    rerender(
        <ToolTip
            {...sharedProps}
            active={false}
            housemakerTourCircle
            pinned
        />
    );
    expect(tooltip).toHaveAttribute("aria-hidden", "true");
    expect(tooltip).toHaveAttribute("inert");
    expect(tooltip).toHaveStyle({ opacity: "0", pointerEvents: "none" });

    rerender(
        <ToolTip
            {...sharedProps}
            active
            housemakerTourCircle={false}
            pinned
        />
    );
    expect(tooltip).not.toHaveAttribute("data-housemaker-tour-interaction");
    expect(tooltip).toHaveStyle({ pointerEvents: "none" });
});
